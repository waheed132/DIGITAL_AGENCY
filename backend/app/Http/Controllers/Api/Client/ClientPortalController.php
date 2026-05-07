<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\Deliverable;
use App\Models\Invoice;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Services\InvoiceDocumentService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ClientPortalController extends Controller
{
    public function __construct(
        private readonly InvoiceDocumentService $documents
    ) {}

    private function resolveClientForUser(User $user): ?Client
    {
        $byEmail = Client::query()
            ->whereRaw('LOWER(TRIM(email)) = ?', [strtolower(trim((string) $user->email))])
            ->first();
        if ($byEmail instanceof Client) {
            return $byEmail;
        }

        $name = trim((string) $user->name);
        if ($name !== '') {
            $byName = Client::query()
                ->where(function ($q) use ($name) {
                    $q->whereRaw('LOWER(TRIM(name)) = ?', [strtolower($name)])
                        ->orWhereRaw('LOWER(TRIM(company)) = ?', [strtolower($name)]);
                })
                ->first();
            if ($byName instanceof Client) {
                return $byName;
            }
        }

        if (app()->environment('local')) {
            return Client::query()->orderBy('id')->first();
        }

        return null;
    }

    /** @return array<int, int> */
    private function projectIdsForClient(Client $client): array
    {
        return Project::query()
            ->where('client_id', $client->id)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    private function invoicesForProjects(array $projectIds)
    {
        if ($projectIds === []) {
            return collect();
        }

        return Invoice::query()
            ->where(function ($q) use ($projectIds) {
                $q->whereIn('project_id', $projectIds)
                    ->orWhereHas('agencyService', fn ($sq) => $sq->whereIn('project_id', $projectIds));
            })
            ->get();
    }

    private function relativeDeadlineLabel(?Carbon $deadline): string
    {
        if ($deadline === null) {
            return 'Scheduled';
        }
        $day = $deadline->copy()->startOfDay();
        $today = now()->startOfDay();
        if ($day->equalTo($today)) {
            return 'Today';
        }
        if ($day->equalTo($today->copy()->addDay())) {
            return 'Tomorrow';
        }
        if ($day->lt($today)) {
            return 'Overdue';
        }

        return $deadline->format('M j');
    }

    /** Open tasks = not done */
    private function isOpenTask(Task $task): bool
    {
        return $task->status !== 'done';
    }

    public function dashboard(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user instanceof User) {
            abort(401);
        }

        $client = $this->resolveClientForUser($user);
        if ($client === null) {
            return response()->json([
                'message' => 'No client profile is linked to this account. Your login email must match the client record.',
            ], 404);
        }

        $projectIds = $this->projectIdsForClient($client);
        $projects = Project::query()
            ->where('client_id', $client->id)
            ->with(['agencyServices' => fn ($q) => $q->orderBy('sort_order')->orderBy('id')])
            ->orderBy('id')
            ->get();

        $tasks = $projectIds === []
            ? collect()
            : Task::query()->whereIn('project_id', $projectIds)->get();

        $completed = $tasks->filter(fn (Task $t) => $t->status === 'done')->count();
        $total = $tasks->count();
        $pending = max(0, $total - $completed);

        $todayStart = now()->startOfDay();
        $atRisk = $tasks
            ->filter(fn (Task $t) => $this->isOpenTask($t) && $t->deadline && Carbon::parse($t->deadline)->lt($todayStart))
            ->isNotEmpty();

        $health = $atRisk ? 'at_risk' : 'on_track';

        $invoices = $this->invoicesForProjects($projectIds);
        $totalAmt = (float) $invoices->sum(fn (Invoice $i) => (float) $i->amount);
        $paidAmt = (float) $invoices->where('status', Invoice::STATUS_PAID)->sum(fn (Invoice $i) => (float) $i->amount);
        $remaining = max(0, round($totalAmt - $paidAmt, 2));

        $recentDeliveries = $tasks
            ->filter(fn (Task $t) => $t->status === 'done')
            ->sortByDesc(fn (Task $t) => $t->reviewed_at ?? $t->updated_at)
            ->take(3)
            ->values()
            ->map(fn (Task $t) => ['title' => $t->title])
            ->all();

        $openTasks = $tasks->filter(fn (Task $t) => $this->isOpenTask($t));
        $withDeadline = $openTasks
            ->filter(fn (Task $t) => $t->deadline !== null)
            ->sortBy(fn (Task $t) => Carbon::parse($t->deadline)->timestamp);
        $withoutDeadline = $openTasks->filter(fn (Task $t) => $t->deadline === null);
        $nextTask = $withDeadline->first() ?? $withoutDeadline->first();

        $nextDelivery = null;
        if ($nextTask instanceof Task) {
            $dl = $nextTask->deadline ? Carbon::parse($nextTask->deadline) : null;
            $nextDelivery = $nextTask->title.' ('.$this->relativeDeadlineLabel($dl).')';
        }

        $primary = $projects->first();
        $serviceLabel = $primary?->agencyServices->first()?->name;

        return response()->json([
            'client' => [
                'id' => $client->id,
                'name' => $client->name,
                'company' => $client->company,
            ],
            'primary_project' => $primary === null ? null : [
                'id' => $primary->id,
                'name' => $primary->name,
                'service_label' => $serviceLabel,
            ],
            'stats' => [
                'completed_items' => $completed,
                'total_items' => $total,
                'pending_items' => $pending,
                'health' => $health,
            ],
            'billing' => [
                'total' => round($totalAmt, 2),
                'paid' => round($paidAmt, 2),
                'remaining' => $remaining,
            ],
            'recent_deliveries' => $recentDeliveries,
            'next_delivery' => $nextDelivery,
        ]);
    }

    public function projects(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user instanceof User) {
            abort(401);
        }

        $client = $this->resolveClientForUser($user);
        if ($client === null) {
            return response()->json(['message' => 'No client profile linked.'], 404);
        }

        $rows = Project::query()
            ->where('client_id', $client->id)
            ->with(['agencyServices' => fn ($q) => $q->orderBy('sort_order')->orderBy('id')])
            ->orderBy('name')
            ->get()
            ->map(function (Project $p) {
                $label = $p->agencyServices->first()?->name;

                return [
                    'id' => $p->id,
                    'name' => $p->name,
                    'status' => $p->status,
                    'service_label' => $label,
                ];
            });

        return response()->json(['projects' => $rows]);
    }

    public function project(Request $request, Project $project): JsonResponse
    {
        $user = $request->user();
        if (! $user instanceof User) {
            abort(401);
        }

        $client = $this->resolveClientForUser($user);
        if ($client === null || (int) $project->client_id !== (int) $client->id) {
            abort(403);
        }

        $project->load([
            'agencyServices' => fn ($q) => $q->orderBy('sort_order')->orderBy('id'),
            'agencyServices.deliverables' => fn ($q) => $q->orderBy('sort_order')->orderBy('id'),
            'tasks' => fn ($q) => $q->orderBy('id'),
        ]);

        $serviceLabel = $project->agencyServices->first()?->name ?? 'Project';

        $deliverableRows = collect();
        foreach ($project->agencyServices as $svc) {
            foreach ($svc->deliverables as $d) {
                $approved = $d->status === Deliverable::STATUS_APPROVED;
                $deliverableRows->push([
                    'id' => $d->id,
                    'title' => $d->title,
                    'service_name' => $svc->name,
                    'status_label' => Deliverable::statusLabel((string) $d->status),
                    'is_complete' => $approved,
                    'due_label' => $d->approved_at
                        ? Carbon::parse($d->approved_at)->format('M j, Y')
                        : ($approved ? 'Delivered' : 'In pipeline'),
                    'preview_url' => $d->submission_url ?: null,
                    'submission_notes' => null,
                ]);
            }
        }

        $deliverables = $deliverableRows->isNotEmpty()
            ? $deliverableRows->values()->all()
            : $project->tasks->map(function (Task $t) {
                $done = $t->status === 'done';

                return [
                    'id' => $t->id,
                    'title' => $t->title,
                    'service_name' => '',
                    'status_label' => $done ? 'Completed' : 'In progress',
                    'is_complete' => $done,
                    'due_label' => $t->deadline
                        ? Carbon::parse($t->deadline)->format('M j, Y')
                        : ($done ? 'Delivered' : 'Scheduled'),
                    'preview_url' => $t->submission_link ?: null,
                    'submission_notes' => $t->submission_notes,
                ];
            })->values()->all();

        $deliverableTotal = count($deliverables);
        $deliverableCompleted = $deliverableRows->isNotEmpty()
            ? $project->agencyServices->sum(
                fn ($svc) => $svc->deliverables->where('status', Deliverable::STATUS_APPROVED)->count(),
            )
            : $project->tasks->where('status', 'done')->count();

        $invoices = $this->invoicesForProjects([(int) $project->id])
            ->sortByDesc('id')
            ->values()
            ->map(function (Invoice $inv) {
                $display = $inv->displayStatus();

                return [
                    'id' => $inv->id,
                    'number' => (string) $inv->invoice_number,
                    'amount' => (float) $inv->amount,
                    'status' => $display === 'paid' ? 'paid' : 'pending',
                    'issued_at' => $inv->created_at?->format('M j, Y') ?? '',
                    'has_pdf' => $inv->pdf_path !== null,
                    'pdf_url' => '/api/client/invoices/'.$inv->id.'/pdf',
                ];
            });

        $feedback = [];
        foreach ($project->tasks as $t) {
            if ($t->client_content) {
                $feedback[] = [
                    'id' => count($feedback) + 10000 + $t->id,
                    'author' => 'client',
                    'message' => (string) $t->client_content,
                    'at' => $t->updated_at?->format('M j, Y g:i A') ?? '',
                ];
            }
            if ($t->admin_feedback) {
                $feedback[] = [
                    'id' => count($feedback) + 20000 + $t->id,
                    'author' => 'agency',
                    'message' => (string) $t->admin_feedback,
                    'at' => $t->reviewed_at?->format('M j, Y g:i A') ?? ($t->updated_at?->format('M j, Y g:i A') ?? ''),
                ];
            }
        }

        return response()->json([
            'project' => [
                'id' => $project->id,
                'name' => $project->name,
                'description' => $project->description,
                'status' => $project->status,
                'service_label' => $serviceLabel,
                'total_items' => $deliverableTotal,
                'completed_items' => $deliverableCompleted,
            ],
            'deliverables' => $deliverables,
            'assets' => [],
            'invoices' => $invoices,
            'feedback' => $feedback,
        ]);
    }

    public function notifications(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user instanceof User) {
            abort(401);
        }

        $client = $this->resolveClientForUser($user);
        if ($client === null) {
            return response()->json(['notifications' => []]);
        }

        $projectIds = $this->projectIdsForClient($client);
        if ($projectIds === []) {
            return response()->json(['notifications' => []]);
        }

        $items = [];

        $invoices = $this->invoicesForProjects($projectIds)->sortByDesc('updated_at')->take(15);
        foreach ($invoices as $inv) {
            $body = 'Invoice #'.$inv->invoice_number.' — '.number_format((float) $inv->amount, 2).' '.$inv->currency;
            if ($inv->status === Invoice::STATUS_PAID) {
                $title = 'Invoice paid';
            } elseif ($inv->status === Invoice::STATUS_SENT) {
                $title = 'Invoice sent';
            } else {
                $title = 'Invoice updated';
            }
            $items[] = [
                'id' => 100000 + $inv->id,
                'kind' => 'invoice',
                'title' => $title,
                'body' => $body,
                'at' => $inv->updated_at?->diffForHumans() ?? '',
                'unread' => false,
            ];
        }

        $recentDone = Task::query()
            ->whereIn('project_id', $projectIds)
            ->where('status', 'done')
            ->orderByDesc('reviewed_at')
            ->orderByDesc('updated_at')
            ->take(10)
            ->get();

        foreach ($recentDone as $t) {
            $items[] = [
                'id' => 200000 + $t->id,
                'kind' => 'delivery',
                'title' => 'Deliverable completed',
                'body' => '"'.$t->title.'" is marked complete.',
                'at' => $t->reviewed_at?->diffForHumans() ?? $t->updated_at?->diffForHumans() ?? '',
                'unread' => false,
            ];
        }

        $revisionTasks = Task::query()
            ->whereIn('project_id', $projectIds)
            ->where('status', 'revision')
            ->orderByDesc('updated_at')
            ->take(5)
            ->get();

        foreach ($revisionTasks as $t) {
            $items[] = [
                'id' => 300000 + $t->id,
                'kind' => 'revision',
                'title' => 'Revision in progress',
                'body' => '"'.$t->title.'" is in revision.',
                'at' => $t->updated_at?->diffForHumans() ?? '',
                'unread' => true,
            ];
        }

        usort($items, fn ($a, $b) => strcmp((string) ($b['id'] ?? ''), (string) ($a['id'] ?? '')));

        return response()->json(['notifications' => array_slice($items, 0, 25)]);
    }

    public function invoicePdf(Request $request, Invoice $invoice): StreamedResponse|\Illuminate\Http\Response
    {
        $user = $request->user();
        if (! $user instanceof User) {
            abort(401);
        }

        $client = $this->resolveClientForUser($user);
        if ($client === null) {
            abort(403);
        }

        $projectIds = $this->projectIdsForClient($client);
        $ok = false;
        if ($invoice->project_id && in_array((int) $invoice->project_id, $projectIds, true)) {
            $ok = true;
        }
        if (! $ok && $invoice->agency_service_id) {
            $invoice->loadMissing('agencyService');
            $svc = $invoice->agencyService;
            if ($svc && in_array((int) $svc->project_id, $projectIds, true)) {
                $ok = true;
            }
        }
        if (! $ok) {
            abort(403);
        }

        if (! $invoice->pdf_path || ! Storage::disk('local')->exists($invoice->pdf_path)) {
            $this->documents->writePdf($invoice->fresh());
            $invoice->refresh();
        }

        $name = 'invoice-'.$invoice->invoice_number.'.pdf';

        return Storage::disk('local')->download($invoice->pdf_path, $name);
    }
}
