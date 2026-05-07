<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TaskController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Task::query()->with(['project.client', 'assignee', 'agencyService', 'attachments.uploader'])->orderByDesc('created_at');

        if ($request->filled('project_id')) {
            $query->where('project_id', $request->integer('project_id'));
        }

        if ($request->filled('assigned_to')) {
            $query->where('assigned_to', $request->integer('assigned_to'));
        }

        return response()->json(
            $query->get()->map(fn (Task $task) => $this->formatTask($task))
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'project_id' => ['required', 'exists:projects,id'],
            'service_id' => [
                'nullable',
                'integer',
                Rule::exists('services', 'id')->where(fn ($q) => $q->where('project_id', (int) $request->input('project_id'))),
            ],
            'assigned_to' => ['nullable', 'exists:users,id'],
            'title' => ['required', 'string', 'max:255'],
            'deliverable_type' => ['nullable', 'string', 'max:64'],
            'description' => ['nullable', 'string'],
            'instructions' => ['required', 'string', 'min:5', 'max:20000'],
            'client_content' => ['nullable', 'string', 'max:20000'],
            'reference_url' => ['nullable', 'string', 'max:2048'],
            'status' => ['nullable', 'string', 'max:32'],
            'priority' => ['nullable', 'string', 'max:32'],
            'deadline' => ['nullable', 'date'],
            'submission_link' => ['nullable', 'url', 'max:2048'],
            'submission_notes' => ['nullable', 'string'],
            'admin_feedback' => ['nullable', 'string'],
        ]);

        $task = Task::query()->create($data);

        return response()->json(
            $this->formatTask($task->load(['project.client', 'assignee', 'agencyService', 'attachments.uploader'])),
            201
        );
    }

    public function show(Task $task): JsonResponse
    {
        return response()->json($this->formatTask($task->load(['project.client', 'assignee', 'agencyService', 'attachments.uploader'])));
    }

    public function update(Request $request, Task $task): JsonResponse
    {
        $data = $request->validate([
            'project_id' => ['sometimes', 'exists:projects,id'],
            'service_id' => [
                'nullable',
                'integer',
                Rule::exists('services', 'id')->where(function ($q) use ($request, $task) {
                    $projectId = (int) ($request->filled('project_id') ? $request->input('project_id') : $task->project_id);
                    $q->where('project_id', $projectId);
                }),
            ],
            'assigned_to' => ['nullable', 'exists:users,id'],
            'title' => ['sometimes', 'string', 'max:255'],
            'deliverable_type' => ['nullable', 'string', 'max:64'],
            'description' => ['nullable', 'string'],
            'instructions' => ['sometimes', 'required', 'string', 'min:5', 'max:20000'],
            'client_content' => ['nullable', 'string', 'max:20000'],
            'reference_url' => ['nullable', 'string', 'max:2048'],
            'status' => ['nullable', 'string', 'max:32'],
            'priority' => ['nullable', 'string', 'max:32'],
            'deadline' => ['nullable', 'date'],
            'submitted_at' => ['nullable', 'date'],
            'submission_link' => ['nullable', 'url', 'max:2048'],
            'submission_notes' => ['nullable', 'string'],
            'admin_feedback' => ['nullable', 'string'],
            'reviewed_at' => ['nullable', 'date'],
        ]);

        $task->update($data);

        return response()->json(
            $this->formatTask($task->fresh()->load(['project.client', 'assignee', 'agencyService', 'attachments.uploader']))
        );
    }

    public function destroy(Task $task): JsonResponse
    {
        $task->delete();

        return response()->json(null, 204);
    }

    /**
     * @return array<string, mixed>
     */
    public function formatTask(Task $task): array
    {
        $row = $task->toArray();
        $row['agency_service'] = $task->relationLoaded('agencyService') && $task->agencyService
            ? $task->agencyService->only(['id', 'name', 'period_label', 'status', 'planned_quantity', 'unit_price'])
            : null;
        $row['attachments'] = $task->attachments->map(function ($attachment): array {
            return [
                'id' => $attachment->id,
                'task_id' => $attachment->task_id,
                'attachment_type' => $attachment->attachment_type,
                'original_name' => $attachment->original_name,
                'mime_type' => $attachment->mime_type,
                'size' => $attachment->size,
                'url' => '/api/attachments/'.$attachment->id,
                'uploaded_at' => $attachment->created_at,
                'uploader' => [
                    'id' => $attachment->uploader?->id,
                    'name' => $attachment->uploader?->name,
                    'role' => $attachment->uploader?->role,
                ],
            ];
        })->values()->all();

        if (! empty($row['project']['client']) && $task->project?->client) {
            $row['project']['client'] = $task->project->client->toApiArray();
        }

        return $row;
    }
}
