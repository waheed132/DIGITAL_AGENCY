<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AgencyService;
use App\Models\Deliverable;
use App\Support\AgencyActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DeliverableController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = Deliverable::query()->with(['service.project.client'])->orderByDesc('updated_at');

        if ($request->filled('service_id')) {
            $q->where('service_id', $request->integer('service_id'));
        }

        if ($request->filled('project_id')) {
            $q->whereHas('service', fn ($s) => $s->where('project_id', $request->integer('project_id')));
        }

        return response()->json($q->limit(500)->get()->map(fn (Deliverable $d) => $this->format($d)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'service_id' => ['required', 'exists:services,id'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'status' => ['nullable', 'string', 'in:pending,in_progress,in_review,revision,submitted,approved'],
        ]);

        $row = Deliverable::query()->create([
            'service_id' => $data['service_id'],
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'status' => $data['status'] ?? Deliverable::STATUS_PENDING,
        ]);

        AgencyActivity::log($request->user(), 'deliverable.created', Deliverable::class, $row->id, [
            'title' => $row->title,
        ]);

        return response()->json($this->format($row->load(['service.project.client'])), 201);
    }

    public function update(Request $request, Deliverable $deliverable): JsonResponse
    {
        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'status' => ['nullable', 'string', 'in:pending,in_progress,in_review,revision,submitted,approved'],
            'submission_url' => ['nullable', 'url', 'max:2048'],
            'internal_notes' => ['nullable', 'string'],
            'submitted_at' => ['nullable', 'date'],
            'approved_at' => ['nullable', 'date'],
        ]);

        if (array_key_exists('status', $data)) {
            if ($data['status'] === Deliverable::STATUS_SUBMITTED && $deliverable->submitted_at === null) {
                $data['submitted_at'] = now();
            }
            if ($data['status'] === Deliverable::STATUS_APPROVED) {
                $data['approved_at'] = $data['approved_at'] ?? now();
            }
        }

        $deliverable->update($data);

        AgencyActivity::log($request->user(), 'deliverable.updated', Deliverable::class, $deliverable->id, [
            'title' => $deliverable->title,
            'status' => $deliverable->status,
        ]);

        return response()->json($this->format($deliverable->fresh()->load(['service.project.client'])));
    }

    public function destroy(Request $request, Deliverable $deliverable): JsonResponse
    {
        $id = $deliverable->id;
        $deliverable->delete();

        AgencyActivity::log($request->user(), 'deliverable.deleted', Deliverable::class, $id, []);

        return response()->json(null, 204);
    }

    /**
     * @return array<string, mixed>
     */
    private function format(Deliverable $d): array
    {
        $row = $d->only([
            'id', 'service_id', 'sort_order', 'title', 'description', 'status', 'submission_url',
            'internal_notes', 'submitted_at', 'approved_at', 'created_at', 'updated_at',
        ]);
        $row['status_label'] = Deliverable::statusLabel((string) $d->status);

        $svc = $d->relationLoaded('service') ? $d->service : null;
        $row['service'] = $svc
            ? [
                'id' => $svc->id,
                'name' => $svc->name,
                'period_label' => $svc->period_label,
                'project' => $svc->relationLoaded('project') && $svc->project
                    ? [
                        'id' => $svc->project->id,
                        'name' => $svc->project->name,
                        'client' => $svc->project->client ? $svc->project->client->only(['id', 'name']) : null,
                    ]
                    : null,
            ]
            : null;

        return $row;
    }
}
