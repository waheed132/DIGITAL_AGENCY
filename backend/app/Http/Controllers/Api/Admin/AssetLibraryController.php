<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\TaskAttachment;
use Illuminate\Http\JsonResponse;

class AssetLibraryController extends Controller
{
    public function index(): JsonResponse
    {
        $attachments = TaskAttachment::query()
            ->with(['task.project.client', 'task.agencyService', 'uploader'])
            ->orderByDesc('created_at')
            ->limit(400)
            ->get();

        return response()->json($attachments->map(function (TaskAttachment $a): array {
            $task = $a->task;
            $project = $task?->project;

            return [
                'id' => $a->id,
                'original_name' => $a->original_name,
                'mime_type' => $a->mime_type,
                'size' => $a->size,
                'url' => '/api/attachments/'.$a->id,
                'uploaded_at' => $a->created_at?->toIso8601String(),
                'task' => $task
                    ? [
                        'id' => $task->id,
                        'title' => $task->title,
                    ]
                    : null,
                'project' => $project
                    ? [
                        'id' => $project->id,
                        'name' => $project->name,
                        'client' => $project->client ? $project->client->only(['id', 'name']) : null,
                    ]
                    : null,
                'service' => $task?->agencyService
                    ? $task->agencyService->only(['id', 'name', 'period_label'])
                    : null,
                'uploader' => $a->uploader
                    ? $a->uploader->only(['id', 'name', 'role'])
                    : null,
            ];
        }));
    }
}
