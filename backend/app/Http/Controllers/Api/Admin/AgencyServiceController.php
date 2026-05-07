<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AgencyService;
use App\Models\Deliverable;
use App\Models\Invoice;
use App\Models\Task;
use App\Models\User;
use App\Support\AgencyActivity;
use App\Support\ServiceUnitSync;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AgencyServiceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $workflow = ServiceUnitSync::workflowColumnsExist();

        $withCount = [
            'deliverables',
            'tasks as tasks_unassigned_count' => fn ($t) => $t->whereNull('assigned_to'),
        ];

        if ($workflow) {
            $withCount['deliverables as deliverables_completed_count'] = fn ($d) => $d
                ->whereHas('tasks')
                ->whereDoesntHave('tasks', fn ($t) => $t->where('status', '!=', 'done'));
            $withCount['tasks as workflow_tasks_count'] = fn ($t) => $t->whereNotNull('deliverable_id');
            $withCount['tasks as workflow_tasks_done_count'] = fn ($t) => $t->whereNotNull('deliverable_id')->where('status', 'done');
        } else {
            $withCount['tasks as legacy_unit_tasks_count'] = fn ($t) => $t;
            $withCount['tasks as legacy_unit_tasks_done_count'] = fn ($t) => $t->where('status', 'done');
        }

        $q = AgencyService::query()
            ->with(['project.client', 'invoice'])
            ->withCount($withCount)
            ->orderBy('sort_order')
            ->orderBy('name');

        if ($request->filled('project_id')) {
            $q->where('project_id', $request->integer('project_id'));
        }

        $rows = $q->get();
        $outOfSync = $rows->filter(function (AgencyService $s) use ($workflow): bool {
            $planned = (int) ($s->planned_quantity ?? 0);

            return $workflow
                ? $planned !== (int) ($s->deliverables_count ?? 0)
                : $planned !== (int) ($s->legacy_unit_tasks_count ?? 0);
        });
        if ($outOfSync->isNotEmpty()) {
            $outOfSync->each(fn (AgencyService $s) => ServiceUnitSync::sync($s));
            $rows = $q->get();
        }

        return response()->json($rows->map(fn (AgencyService $s) => $this->format($s)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'project_id' => ['required', 'exists:projects,id'],
            'name' => ['required', 'string', 'max:255'],
            'planned_quantity' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'unit_price' => ['nullable', 'numeric', 'min:0', 'max:999999999.99'],
            'period_label' => ['nullable', 'string', 'max:64'],
            'description' => ['nullable', 'string'],
            'status' => ['nullable', 'string', 'in:active,archived'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:65535'],
        ]);

        $service = AgencyService::query()->create([
            'project_id' => $data['project_id'],
            'name' => $data['name'],
            'planned_quantity' => $data['planned_quantity'] ?? 0,
            'unit_price' => $data['unit_price'] ?? 0,
            'period_label' => $data['period_label'] ?? null,
            'description' => $data['description'] ?? null,
            'status' => $data['status'] ?? 'active',
            'sort_order' => $data['sort_order'] ?? 0,
        ]);

        $unitSync = ServiceUnitSync::sync($service->fresh());

        AgencyActivity::log($request->user(), 'service.created', AgencyService::class, $service->id, [
            'name' => $service->name,
            'project_id' => $service->project_id,
        ]);

        $payload = $this->format($service->fresh()->load(['project.client']));
        $payload['unit_sync'] = $unitSync;

        return response()->json($payload, 201);
    }

    public function update(Request $request, AgencyService $agencyService): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'planned_quantity' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'unit_price' => ['nullable', 'numeric', 'min:0', 'max:999999999.99'],
            'period_label' => ['nullable', 'string', 'max:64'],
            'description' => ['nullable', 'string'],
            'status' => ['nullable', 'string', 'in:active,archived'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:65535'],
        ]);

        if (array_key_exists('planned_quantity', $data) && $data['planned_quantity'] !== null) {
            $newPlanned = max(0, (int) $data['planned_quantity']);
            $min = ServiceUnitSync::minimumPlannedQuantity($agencyService);
            if ($newPlanned < $min) {
                throw ValidationException::withMessages([
                    'planned_quantity' => "Quantity cannot be below {$min}. Finish, submit, or wait for in‑progress units to clear before reducing the plan.",
                ]);
            }
        }

        $agencyService->update($data);

        $unitSync = ServiceUnitSync::sync($agencyService->fresh());

        AgencyActivity::log($request->user(), 'service.updated', AgencyService::class, $agencyService->id, [
            'name' => $agencyService->name,
        ]);

        $payload = $this->format($agencyService->fresh()->load(['project.client']));
        $payload['unit_sync'] = $unitSync;

        return response()->json($payload);
    }

    public function destroy(Request $request, AgencyService $agencyService): JsonResponse
    {
        $id = $agencyService->id;
        $agencyService->delete();

        AgencyActivity::log($request->user(), 'service.deleted', AgencyService::class, $id, []);

        return response()->json(null, 204);
    }

    public function backfillAssignees(AgencyService $agencyService): JsonResponse
    {
        $n = ServiceUnitSync::backfillUnassignedAssignees($agencyService->fresh()->load('project'));

        return response()->json([
            'ok' => true,
            'tasks_updated' => $n,
        ]);
    }

    public function assignUnassignedTasks(Request $request, AgencyService $agencyService): JsonResponse
    {
        $data = $request->validate([
            'user_id' => [
                'required',
                'integer',
                Rule::exists('users', 'id')->where(function ($q): void {
                    $q->where('role', User::ROLE_EMPLOYEE)
                        ->where('is_active', true);
                }),
            ],
        ]);
        $project = $agencyService->project;
        if (! $project) {
            abort(404);
        }
        if (! $project->members()->where('users.id', (int) $data['user_id'])->exists()) {
            throw ValidationException::withMessages([
                'user_id' => 'This user is not a member of the project. Add them in the project first.',
            ]);
        }

        $n = Task::query()
            ->where('project_id', $agencyService->project_id)
            ->where('service_id', $agencyService->id)
            ->whereNull('assigned_to')
            ->update(['assigned_to' => (int) $data['user_id']]);

        return response()->json([
            'ok' => true,
            'assigned' => $n,
        ]);
    }

    public function units(AgencyService $agencyService): JsonResponse
    {
        if (! ServiceUnitSync::workflowColumnsExist()) {
            $rows = Task::query()
                ->where('project_id', $agencyService->project_id)
                ->where('service_id', $agencyService->id)
                ->with(['assignee:id,name'])
                ->orderBy('id')
                ->get();

            $planned = (int) ($agencyService->planned_quantity ?? 0);
            $total = max($planned, $rows->count());

            return response()->json([
                'service_id' => $agencyService->id,
                'service_name' => $agencyService->name,
                'planned_quantity' => $planned,
                'unit_price' => (string) ($agencyService->unit_price ?? '0'),
                'units' => $rows->values()->map(function (Task $t, int $idx) use ($total): array {
                    return [
                        'index' => $idx + 1,
                        'total' => $total,
                        'id' => $t->id,
                        'title' => $t->title,
                        'status' => $t->status,
                        'assignee' => $t->assignee?->only(['id', 'name']),
                    ];
                }),
            ]);
        }

        $agencyService->loadMissing(['deliverables.tasks.assignee']);
        $planned = (int) ($agencyService->planned_quantity ?? 0);
        $list = $agencyService->deliverables->sortBy(fn ($d) => [$d->sort_order, $d->id])->values();
        $total = max($planned, $list->count());

        $units = $list->map(function (Deliverable $d, int $idx) use ($total): array {
            return [
                'index' => $idx + 1,
                'total' => $total,
                'id' => $d->id,
                'title' => $d->title,
                'deliverable_status' => $d->status,
                'deliverable_status_label' => Deliverable::statusLabel($d->status),
                'workflow' => $d->tasks->map(fn (Task $t): array => [
                    'id' => $t->id,
                    'workflow_step' => $t->workflow_step,
                    'title' => $t->title,
                    'status' => $t->status,
                    'assignee' => $t->assignee?->only(['id', 'name']),
                ])->values()->all(),
            ];
        });

        return response()->json([
            'service_id' => $agencyService->id,
            'service_name' => $agencyService->name,
            'planned_quantity' => $planned,
            'unit_price' => (string) ($agencyService->unit_price ?? '0'),
            'units' => $units,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function format(AgencyService $s): array
    {
        $row = $s->only([
            'id',
            'project_id',
            'name',
            'planned_quantity',
            'unit_price',
            'period_label',
            'description',
            'status',
            'sort_order',
            'created_at',
            'updated_at',
        ]);
        $row['project'] = $s->relationLoaded('project') && $s->project
            ? [
                'id' => $s->project->id,
                'name' => $s->project->name,
                'client' => $s->project->client ? $s->project->client->only(['id', 'name']) : null,
            ]
            : null;
        if (ServiceUnitSync::workflowColumnsExist()) {
            $row['tasks_count'] = (int) ($s->deliverables_count ?? $s->deliverables()->count());
            $row['tasks_done_count'] = (int) ($s->deliverables_completed_count ?? 0);
            $row['deliverables_completed_count'] = (int) ($s->deliverables_completed_count ?? 0);
            $row['workflow_tasks_count'] = (int) ($s->workflow_tasks_count ?? $s->tasks()->whereNotNull('deliverable_id')->count());
            $row['workflow_tasks_done_count'] = (int) ($s->workflow_tasks_done_count ?? $s->tasks()->whereNotNull('deliverable_id')->where('status', 'done')->count());
        } else {
            $row['tasks_count'] = (int) ($s->legacy_unit_tasks_count ?? $s->tasks()->count());
            $row['tasks_done_count'] = (int) ($s->legacy_unit_tasks_done_count ?? $s->tasks()->where('status', 'done')->count());
            $row['deliverables_completed_count'] = $row['tasks_done_count'];
            $row['workflow_tasks_count'] = 0;
            $row['workflow_tasks_done_count'] = 0;
        }

        $row['tasks_unassigned_count'] = (int) ($s->tasks_unassigned_count ?? $s->tasks()->whereNull('assigned_to')->count());
        $row['deliverables_count'] = (int) ($s->deliverables_count ?? $s->deliverables()->count());
        $row['invoice'] = $s->relationLoaded('invoice') && $s->invoice instanceof Invoice
            ? $s->invoice->toApiArray()
            : null;

        return $row;
    }
}
