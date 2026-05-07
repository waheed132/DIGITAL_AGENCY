<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;

class ActivityFeedController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = ActivityLog::query()
            ->with(['user:id,name,email,role'])
            ->orderByDesc('created_at')
            ->limit(200)
            ->get();

        return response()->json($rows->map(function (ActivityLog $log): array {
            return [
                'id' => $log->id,
                'action' => $log->action,
                'subject_type' => $log->subject_type,
                'subject_id' => $log->subject_id,
                'properties' => $log->properties,
                'created_at' => $log->created_at?->toIso8601String(),
                'user' => $log->user
                    ? $log->user->only(['id', 'name', 'email', 'role'])
                    : null,
            ];
        }));
    }
}
