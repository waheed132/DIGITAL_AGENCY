<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TaskAttachment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AttachmentAccessController extends Controller
{
    public function show(Request $request, TaskAttachment $attachment): StreamedResponse
    {
        $user = $request->user();
        $task = $attachment->task;

        if (!$user) {
            abort(401);
        }

        if (!$user->isAdmin() && $task?->assigned_to !== $user->id) {
            abort(403, 'You are not allowed to access this file.');
        }

        if (!Storage::disk('public')->exists($attachment->storage_path)) {
            abort(404, 'File not found.');
        }

        $headers = [
            'Content-Type' => $attachment->mime_type ?: 'application/octet-stream',
            'Content-Disposition' => 'inline; filename="'.addslashes($attachment->original_name).'"',
        ];

        return Storage::disk('public')->response($attachment->storage_path, $attachment->original_name, $headers);
    }
}
