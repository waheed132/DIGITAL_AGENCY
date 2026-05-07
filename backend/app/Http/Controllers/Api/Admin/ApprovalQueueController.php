<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Support\AgencyActivity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ApprovalQueueController extends Controller
{
    public function __construct(
        private TaskController $taskFormatter
    ) {}

    public function index(): JsonResponse
    {
        $tasks = Task::query()
            ->with(['project.client', 'assignee', 'agencyService', 'attachments.uploader'])
            ->where('status', 'review')
            ->orderBy('submitted_at')
            ->limit(200)
            ->get();

        return response()->json(
            $tasks->map(fn (Task $task) => $this->taskFormatter->formatTask($task))
        );
    }

    public function approve(Request $request, Task $task): JsonResponse
    {
        if ($task->status !== 'review') {
            return response()->json(['message' => 'Only tasks in review can be approved.'], 422);
        }

        $task->update([
            'status' => 'done',
            'reviewed_at' => now(),
        ]);

        AgencyActivity::log($request->user(), 'task.approved', Task::class, $task->id, [
            'title' => $task->title,
            'project_id' => $task->project_id,
        ]);

        return response()->json(
            $this->taskFormatter->formatTask($task->fresh()->load(['project.client', 'assignee', 'agencyService', 'attachments.uploader']))
        );
    }

    public function requestRevision(Request $request, Task $task): JsonResponse
    {
        if ($task->status !== 'review') {
            return response()->json(['message' => 'Only tasks in review can be sent back for revision.'], 422);
        }

        $data = $request->validate([
            'admin_feedback' => ['required', 'string', 'max:8000'],
        ]);

        $task->update([
            'status' => 'revision',
            'admin_feedback' => $data['admin_feedback'],
            'reviewed_at' => null,
        ]);

        AgencyActivity::log($request->user(), 'task.revision_requested', Task::class, $task->id, [
            'title' => $task->title,
            'project_id' => $task->project_id,
        ]);

        return response()->json(
            $this->taskFormatter->formatTask($task->fresh()->load(['project.client', 'assignee', 'agencyService', 'attachments.uploader']))
        );
    }

    /**
     * Send task back to Doing (wrong submission / full redo). Distinct from revision (small fixes with feedback loop).
     */
    public function returnToDoing(Request $request, Task $task): JsonResponse
    {
        if ($task->status !== 'review') {
            return response()->json(['message' => 'Only tasks in review can be returned to Doing.'], 422);
        }

        $data = $request->validate([
            'admin_feedback' => ['nullable', 'string', 'max:8000'],
        ]);

        $updates = [
            'status' => 'doing',
            'submitted_at' => null,
            'reviewed_at' => null,
        ];
        if (array_key_exists('admin_feedback', $data)) {
            $updates['admin_feedback'] = $data['admin_feedback'];
        }
        $task->update($updates);

        AgencyActivity::log($request->user(), 'task.returned_to_doing', Task::class, $task->id, [
            'title' => $task->title,
            'project_id' => $task->project_id,
        ]);

        return response()->json(
            $this->taskFormatter->formatTask($task->fresh()->load(['project.client', 'assignee', 'agencyService', 'attachments.uploader']))
        );
    }
}
