<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CalendarController extends Controller
{
    public function tasks(Request $request): JsonResponse
    {
        $data = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after_or_equal:from'],
        ]);

        $from = $data['from'].' 00:00:00';
        $to = $data['to'].' 23:59:59';

        $tasks = Task::query()
            ->with(['project.client', 'assignee', 'agencyService'])
            ->whereNotNull('deadline')
            ->whereBetween('deadline', [$from, $to])
            ->orderBy('deadline')
            ->limit(500)
            ->get();

        return response()->json($tasks->map(function (Task $task): array {
            return [
                'id' => $task->id,
                'title' => $task->title,
                'status' => $task->status,
                'priority' => $task->priority,
                'deadline' => $task->deadline?->toIso8601String(),
                'project_id' => $task->project_id,
                'service_id' => $task->service_id,
                'assigned_to' => $task->assigned_to,
                'is_overdue' => $task->deadline !== null
                    && $task->deadline->isPast()
                    && ! in_array($task->status, ['done'], true),
                'project' => $task->project
                    ? ['id' => $task->project->id, 'name' => $task->project->name]
                    : null,
                'assignee' => $task->assignee
                    ? ['id' => $task->assignee->id, 'name' => $task->assignee->name]
                    : null,
                'agency_service' => $task->agencyService
                    ? $task->agencyService->only(['id', 'name', 'period_label'])
                    : null,
            ];
        }));
    }
}
