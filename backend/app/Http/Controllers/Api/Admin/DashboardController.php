<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\Project;
use App\Models\Task;
use App\Models\OfficeExpense;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

class DashboardController extends Controller
{
    public function stats(): JsonResponse
    {
        $taskStatuses = ['todo', 'doing', 'review', 'done'];
        $taskCounts = [];
        foreach ($taskStatuses as $s) {
            $taskCounts[$s] = Task::query()->where('status', $s)->count();
        }

        $projectByStatus = Project::query()
            ->selectRaw('status, COUNT(*) as c')
            ->groupBy('status')
            ->pluck('c', 'status');

        $today = Carbon::now()->toDateString();
        $y = (int) Carbon::now()->year;
        $m = (int) Carbon::now()->month;
        $expensesToday = OfficeExpense::query()->whereDate('expense_date', $today)->sum('amount');
        $expensesMonth = OfficeExpense::query()
            ->whereYear('expense_date', $y)
            ->whereMonth('expense_date', $m)
            ->sum('amount');

        return response()->json([
            'expenses' => [
                'today_total' => (string) $expensesToday,
                'month_total' => (string) $expensesMonth,
            ],
            'counts' => [
                'clients' => Client::query()->count(),
                'projects' => Project::query()->count(),
                'tasks_total' => Task::query()->count(),
                'tasks' => $taskCounts,
                'team_members' => User::query()
                    ->where('role', User::ROLE_EMPLOYEE)
                    ->where('is_active', true)
                    ->count(),
            ],
            'projects_by_status' => $projectByStatus,
            'recent_tasks' => Task::query()
                ->with(['project:id,name', 'assignee:id,name'])
                ->latest()
                ->limit(6)
                ->get()
                ->map(fn (Task $t) => [
                    'id' => $t->id,
                    'title' => $t->title,
                    'status' => $t->status,
                    'priority' => $t->priority,
                    'deadline' => $t->deadline?->toIso8601String(),
                    'project' => $t->project ? ['id' => $t->project->id, 'name' => $t->project->name] : null,
                    'assignee' => $t->assignee ? ['id' => $t->assignee->id, 'name' => $t->assignee->name] : null,
                ]),
            'recent_clients' => Client::query()
                ->latest()
                ->limit(4)
                ->get(['id', 'name', 'company', 'created_at']),
        ]);
    }
}
