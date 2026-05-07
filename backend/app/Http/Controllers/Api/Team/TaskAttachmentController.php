<?php

namespace App\Http\Controllers\Api\Team;

use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Models\TaskAttachment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class TaskAttachmentController extends Controller
{
    public function store(Request $request, Task $task): JsonResponse
    {
        if ($task->assigned_to !== $request->user()->id) {
            abort(403, 'This task is not assigned to you.');
        }

        $data = $request->validate([
            'file' => [
                'required',
                'file',
                'max:51200',
                'mimetypes:image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/quicktime,video/webm,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain',
            ],
        ]);

        $file = $data['file'];
        $path = $file->store('task-attachments', 'public');

        $attachment = $task->attachments()->create([
            'uploaded_by' => $request->user()->id,
            'attachment_type' => 'submission',
            'original_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getClientMimeType() ?: $file->getMimeType(),
            'size' => $file->getSize(),
            'storage_path' => $path,
        ]);

        return response()->json($this->formatAttachment($attachment), 201);
    }

    public function destroy(Request $request, Task $task, TaskAttachment $attachment): JsonResponse
    {
        if ($task->assigned_to !== $request->user()->id || $attachment->task_id !== $task->id) {
            abort(403, 'You are not allowed to remove this file.');
        }

        if ($attachment->uploaded_by !== $request->user()->id) {
            abort(403, 'You can remove only your own uploaded files.');
        }

        Storage::disk('public')->delete($attachment->storage_path);
        $attachment->delete();

        return response()->json(null, 204);
    }

    /**
     * @return array<string, mixed>
     */
    private function formatAttachment(TaskAttachment $attachment): array
    {
        $attachment->loadMissing('uploader');

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
    }
}
