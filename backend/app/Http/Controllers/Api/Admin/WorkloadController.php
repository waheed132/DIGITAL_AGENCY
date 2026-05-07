<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class WorkloadController extends Controller
{
    public function index(): JsonResponse
    {
        $users = User::query()
            ->where('is_active', true)
            ->whereIn('role', [User::ROLE_ADMIN, User::ROLE_EMPLOYEE])
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'role']);

        $statuses = ['todo', 'doing', 'review', 'revision', 'done'];

        $payload = $users->map(function (User $user) use ($statuses): array {
            $byStatus = [];
            foreach ($statuses as $s) {
                $byStatus[$s] = Task::query()
                    ->where('assigned_to', $user->id)
                    ->where('status', $s)
                    ->count();
            }

            $open = Task::query()
                ->where('assigned_to', $user->id)
                ->whereNotIn('status', ['done'])
                ->count();

            $overdue = Task::query()
                ->where('assigned_to', $user->id)
                ->whereNotIn('status', ['done'])
                ->whereNotNull('deadline')
                ->where('deadline', '<', now())
                ->count();

            $nextDeadlines = Task::query()
                ->where('assigned_to', $user->id)
                ->whereNotIn('status', ['done'])
                ->whereNotNull('deadline')
                ->orderBy('deadline')
                ->limit(5)
                ->get(['id', 'title', 'deadline', 'status', 'project_id']);

            return [
                'user' => $user->only(['id', 'name', 'email', 'role']),
                'open_tasks' => $open,
                'overdue_tasks' => $overdue,
                'is_overloaded' => $open >= 12 || $overdue >= 3,
                'by_status' => $byStatus,
                'next_deadlines' => $nextDeadlines->map(fn (Task $t) => [
                    'id' => $t->id,
                    'title' => $t->title,
                    'deadline' => $t->deadline?->toIso8601String(),
                    'status' => $t->status,
                    'project_id' => $t->project_id,
                ]),
            ];
        });

        return response()->json($payload);
    }
}
