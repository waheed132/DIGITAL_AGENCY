<?php

namespace App\Http\Controllers\Api\Team;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\AgencyService;
use App\Models\Deliverable;
use App\Models\Project;
use App\Models\Task;
use App\Support\ServiceUnitSync;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class TaskController extends Controller
{
    public function analytics(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $range = $request->query('range', 'week');
        if (! is_string($range) || ! in_array($range, ['week', 'month', 'all'], true)) {
            $range = 'week';
        }

        $periodStart = match ($range) {
            'month' => now()->copy()->startOfMonth(),
            'all' => null,
            default => now()->copy()->startOfWeek(),
        };

        $statusCounts = [];
        foreach (['todo', 'doing', 'review', 'revision', 'done'] as $status) {
            $statusCounts[$status] = Task::query()
                ->where('assigned_to', $userId)
                ->where('status', $status)
                ->count();
        }

        $openStatuses = ['todo', 'doing', 'review', 'revision'];
        $openTasks = Task::query()
            ->where('assigned_to', $userId)
            ->whereIn('status', $openStatuses)
            ->count();

        $overdue = Task::query()
            ->where('assigned_to', $userId)
            ->whereIn('status', $openStatuses)
            ->whereNotNull('deadline')
            ->where('deadline', '<', now())
            ->count();

        $tomorrow = now()->copy()->addDay();
        $dueTomorrow = Task::query()
            ->where('assigned_to', $userId)
            ->whereIn('status', $openStatuses)
            ->whereNotNull('deadline')
            ->whereDate('deadline', $tomorrow->toDateString())
            ->count();

        $dueToday = Task::query()
            ->where('assigned_to', $userId)
            ->whereIn('status', $openStatuses)
            ->whereNotNull('deadline')
            ->whereDate('deadline', now()->toDateString())
            ->count();

        $stuckInReview = Task::query()
            ->where('assigned_to', $userId)
            ->where('status', 'review')
            ->whereRaw('COALESCE(submitted_at, updated_at) < ?', [now()->copy()->subDays(3)])
            ->count();

        $revisionOpen = (int) ($statusCounts['revision'] ?? 0);

        $projectsCount = Project::query()
            ->where('status', 'active')
            ->whereHas('members', fn ($q) => $q->where('users.id', $userId))
            ->count();

        $tasksTotal = Task::query()->where('assigned_to', $userId)->count();
        $doneTotal = (int) ($statusCounts['done'] ?? 0);

        $doneInPeriod = Task::query()
            ->where('assigned_to', $userId)
            ->where('status', 'done')
            ->when($periodStart !== null, fn ($q) => $q->where('updated_at', '>=', $periodStart))
            ->count();

        $doneWithDeadlineInPeriod = Task::query()
            ->where('assigned_to', $userId)
            ->where('status', 'done')
            ->whereNotNull('deadline')
            ->when($periodStart !== null, fn ($q) => $q->where('updated_at', '>=', $periodStart))
            ->get(['deadline', 'updated_at']);

        $onTime = 0;
        foreach ($doneWithDeadlineInPeriod as $t) {
            if ($t->updated_at && $t->deadline && $t->updated_at->lte($t->deadline)) {
                $onTime++;
            }
        }
        $onTimeDenominator = $doneWithDeadlineInPeriod->count();
        $onTimePct = $onTimeDenominator > 0 ? (int) round(100 * $onTime / $onTimeDenominator) : null;

        $completionRatePct = $tasksTotal > 0 ? (int) round(100 * $doneTotal / $tasksTotal) : 100;

        $weeklyActivity = [];
        for ($i = 6; $i >= 0; $i--) {
            $day = now()->copy()->subDays($i)->startOfDay();
            $dayEnd = $day->copy()->endOfDay();
            $weeklyActivity[] = [
                'date' => $day->toDateString(),
                'label' => $day->format('D'),
                'count' => Task::query()
                    ->where('assigned_to', $userId)
                    ->where('status', 'done')
                    ->whereBetween('updated_at', [$day, $dayEnd])
                    ->count(),
            ];
        }

        $periodLabel = match ($range) {
            'month' => 'this month',
            'all' => 'all time',
            default => 'this week',
        };

        $insights = [];
        if ($doneInPeriod > 0) {
            $insights[] = "You completed {$doneInPeriod} task".($doneInPeriod === 1 ? '' : 's')." {$periodLabel}.";
        } else {
            $insights[] = $range === 'all'
                ? 'No completed tasks recorded yet — open My Tasks to ship your first piece of work.'
                : "No tasks marked done {$periodLabel} yet — small wins still count.";
        }
        if ($overdue > 0) {
            $insights[] = "You have {$overdue} overdue open task".($overdue === 1 ? '' : 's').' — unblock dates first.';
        } else {
            $insights[] = 'No overdue tasks right now — great for predictability.';
        }
        if ($onTimePct !== null && $onTimeDenominator > 0) {
            $insights[] = "On-time finish rate (tasks with a deadline): {$onTimePct}% ({$onTime} of {$onTimeDenominator}).";
        }

        $performanceTier = 'strong';
        if ($overdue > 0 || ($onTimePct !== null && $onTimeDenominator >= 3 && $onTimePct < 55)) {
            $performanceTier = 'needs_attention';
        } elseif ($stuckInReview > 0 || $revisionOpen > 1 || ($onTimePct !== null && $onTimeDenominator >= 3 && $onTimePct < 80)) {
            $performanceTier = 'solid';
        }

        $focusAlerts = [];
        if ($dueTomorrow > 0) {
            $focusAlerts[] = [
                'severity' => 'warning',
                'title' => 'Due tomorrow',
                'body' => "You have {$dueTomorrow} open task".($dueTomorrow === 1 ? '' : 's').' due tomorrow.',
            ];
        }
        if ($dueToday > 0) {
            $focusAlerts[] = [
                'severity' => 'warning',
                'title' => 'Due today',
                'body' => "{$dueToday} open task".($dueToday === 1 ? ' is' : 's are').' due today.',
            ];
        }
        if ($stuckInReview > 0) {
            $focusAlerts[] = [
                'severity' => 'info',
                'title' => 'Waiting on admin',
                'body' => "{$stuckInReview} task".($stuckInReview === 1 ? ' has' : 's have').' been in review for 3+ days — nudge your lead if needed.',
            ];
        }
        if ($revisionOpen > 0) {
            $focusAlerts[] = [
                'severity' => 'info',
                'title' => 'In revision',
                'body' => "{$revisionOpen} task".($revisionOpen === 1 ? '' : 's').' need changes before resubmitting.',
            ];
        }

        return response()->json([
            'range' => $range,
            'period_label' => $periodLabel,
            'tasks_total' => $tasksTotal,
            'tasks_by_status' => $statusCounts,
            'open_tasks' => $openTasks,
            'overdue_tasks' => $overdue,
            'projects_total' => $projectsCount,
            'done_in_period' => $doneInPeriod,
            'completion_rate_pct' => $completionRatePct,
            'on_time_pct' => $onTimePct,
            'on_time_denominator' => $onTimeDenominator,
            'weekly_activity' => $weeklyActivity,
            'chart_caption' => 'Tasks marked done (last 7 days)',
            'insights' => $insights,
            'performance_tier' => $performanceTier,
            'focus_alerts' => $focusAlerts,
            'signals' => [
                'due_tomorrow' => $dueTomorrow,
                'due_today' => $dueToday,
                'stuck_in_review' => $stuckInReview,
                'revision_open' => $revisionOpen,
            ],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $tasks = Task::query()
            ->with(['project.client', 'agencyService', 'assignee', 'attachments.uploader'])
            ->where('assigned_to', $userId)
            ->orderByRaw("FIELD(status, 'todo', 'doing', 'review', 'revision', 'done')")
            ->orderBy('deadline')
            ->get();

        /** @var array<int, array<string, int>> $serviceProgress */
        $serviceProgress = [];
        /** @var array<int, array{index: int, total: int}> $taskUnitMeta */
        $taskUnitMeta = [];
        if ($tasks->isNotEmpty()) {
            [$serviceProgress, $taskUnitMeta] = $this->buildServiceUnitMaps($tasks, $userId);
        }

        return response()->json(
            $tasks->map(function (Task $task) use ($serviceProgress, $taskUnitMeta) {
                $sid = (int) ($task->service_id ?? 0);

                return $this->formatTask(
                    $task,
                    $sid > 0 ? ($serviceProgress[$sid] ?? null) : null,
                    $taskUnitMeta[$task->id] ?? null
                );
            })
        );
    }

    public function projects(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $projects = Project::query()
            ->whereHas('members', fn ($q) => $q->where('users.id', $userId))
            ->with(['client'])
            ->orderByRaw("CASE status WHEN 'active' THEN 0 WHEN 'on_hold' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END")
            ->orderBy('name')
            ->get();

        if ($projects->isEmpty()) {
            return response()->json([]);
        }

        $projectIds = $projects->pluck('id')->all();
        $deliverableProgress = $this->deliverableProgressByProject($projectIds);
        $taskAgg = Task::query()
            ->where('assigned_to', $userId)
            ->whereIn('project_id', $projectIds)
            ->groupBy('project_id')
            ->selectRaw('project_id')
            ->selectRaw('COUNT(*) as my_tasks_total')
            ->selectRaw("SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as my_tasks_done")
            ->get()
            ->keyBy('project_id');
        $signalRows = Task::query()
            ->where('assigned_to', $userId)
            ->whereIn('project_id', $projectIds)
            ->whereNotIn('status', ['done'])
            ->groupBy('project_id')
            ->selectRaw('project_id')
            ->selectRaw('SUM(CASE WHEN deadline IS NOT NULL AND deadline < ? THEN 1 ELSE 0 END) as overdue_count', [now()])
            ->selectRaw('SUM(CASE WHEN deadline IS NOT NULL AND DATE(deadline) = DATE(?) THEN 1 ELSE 0 END) as due_today_count', [now()])
            ->selectRaw("SUM(CASE WHEN status = 'revision' THEN 1 ELSE 0 END) as revision_count")
            ->selectRaw("SUM(CASE WHEN status = 'review' THEN 1 ELSE 0 END) as review_count")
            ->selectRaw('SUM(CASE WHEN deadline IS NOT NULL AND deadline >= ? AND deadline <= ? THEN 1 ELSE 0 END) as due_soon_count', [
                now(),
                now()->copy()->addDays(2)->endOfDay(),
            ])
            ->get()
            ->keyBy('project_id');

        $nextTasks = Task::query()
            ->where('assigned_to', $userId)
            ->whereIn('project_id', $projectIds)
            ->whereNotIn('status', ['done'])
            ->with(['deliverable:id,title', 'agencyService:id,name'])
            ->orderByRaw("CASE status WHEN 'doing' THEN 1 WHEN 'revision' THEN 2 WHEN 'todo' THEN 3 WHEN 'review' THEN 4 ELSE 5 END")
            ->orderByRaw('CASE WHEN deadline IS NULL THEN 1 ELSE 0 END')
            ->orderBy('deadline')
            ->orderBy('id')
            ->get();

        $nextByProject = [];
        foreach ($nextTasks as $task) {
            $pid = (int) $task->project_id;
            if (! isset($nextByProject[$pid])) {
                $nextByProject[$pid] = $task;
            }
        }

        $payload = $projects->map(function (Project $p) use ($deliverableProgress, $taskAgg, $signalRows, $nextByProject) {
            $pid = (int) $p->id;
            $row = $p->toArray();
            if ($p->client) {
                $row['client'] = $p->client->toApiArray();
            }

            $agg = $taskAgg->get($pid);
            $myTasksTotal = (int) ($agg?->my_tasks_total ?? 0);
            $myTasksDone = (int) ($agg?->my_tasks_done ?? 0);
            $row['my_tasks_total'] = $myTasksTotal;
            $row['my_tasks_done'] = $myTasksDone;
            $row['my_tasks_progress_pct'] = $myTasksTotal > 0
                ? (int) round(100 * $myTasksDone / $myTasksTotal)
                : 0;

            $dProg = $deliverableProgress[$pid] ?? ['total' => 0, 'completed' => 0];
            $row['deliverables_total'] = $dProg['total'];
            $row['deliverables_completed'] = $dProg['completed'];
            $row['deliverables_progress_pct'] = $dProg['total'] > 0
                ? (int) round(100 * $dProg['completed'] / $dProg['total'])
                : ($myTasksTotal > 0 ? $row['my_tasks_progress_pct'] : 0);

            $sig = $signalRows->get($pid);
            $overdue = (int) ($sig?->overdue_count ?? 0);
            $dueToday = (int) ($sig?->due_today_count ?? 0);
            $dueSoon = (int) ($sig?->due_soon_count ?? 0);
            $revision = (int) ($sig?->revision_count ?? 0);
            $review = (int) ($sig?->review_count ?? 0);

            $row['signals'] = [
                'overdue_open_tasks' => $overdue,
                'due_today_open_tasks' => $dueToday,
                'due_soon_open_tasks' => max(0, $dueSoon - $overdue),
                'revision_tasks' => $revision,
                'review_tasks' => $review,
            ];

            if ($overdue > 0) {
                $row['work_health'] = 'overdue';
            } elseif ($revision > 0 || $dueToday > 0 || $dueSoon > 0) {
                $row['work_health'] = 'due_soon';
            } else {
                $row['work_health'] = 'on_track';
            }

            $next = $nextByProject[$pid] ?? null;
            if ($next) {
                $row['next_task'] = [
                    'id' => $next->id,
                    'title' => $next->title,
                    'status' => $next->status,
                    'deadline' => $next->deadline?->toIso8601String(),
                    'context_line' => $this->nextTaskContextLine($next),
                ];
            } else {
                $row['next_task'] = null;
            }

            $row['needs_attention'] = $overdue > 0 || $revision > 0 || $dueToday > 0;

            $row['project_deadline_due_today'] = $p->deadline && $p->deadline->isSameDay(now());

            $row['has_open_work'] = $next !== null;

            return $row;
        });

        return response()->json($payload);
    }

    /**
     * @param  list<int>  $projectIds
     * @return array<int, array{total: int, completed: int}>
     */
    private function deliverableProgressByProject(array $projectIds): array
    {
        $services = AgencyService::query()
            ->whereIn('project_id', $projectIds)
            ->get(['id', 'project_id']);

        $base = [];
        foreach ($projectIds as $pid) {
            $base[(int) $pid] = ['total' => 0, 'completed' => 0];
        }

        if ($services->isEmpty()) {
            return $base;
        }

        $serviceIdToProjectId = $services->pluck('project_id', 'id')->all();
        $serviceIds = $services->pluck('id')->unique()->values()->all();

        $deliverables = Deliverable::query()
            ->whereIn('service_id', $serviceIds)
            ->with(['tasks:id,deliverable_id,status'])
            ->get(['id', 'service_id']);

        foreach ($deliverables as $d) {
            $sid = (int) $d->service_id;
            $projectId = (int) ($serviceIdToProjectId[$sid] ?? 0);
            if ($projectId === 0 || ! isset($base[$projectId])) {
                continue;
            }
            $base[$projectId]['total']++;
            $tasks = $d->tasks;
            if ($tasks->isNotEmpty() && $tasks->every(fn (Task $t) => $t->status === 'done')) {
                $base[$projectId]['completed']++;
            }
        }

        return $base;
    }

    private function nextTaskContextLine(Task $t): string
    {
        $parts = [];
        if ($t->relationLoaded('agencyService') && $t->agencyService) {
            $parts[] = (string) $t->agencyService->name;
        }
        if ($t->relationLoaded('deliverable') && $t->deliverable) {
            $parts[] = (string) $t->deliverable->title;
        }
        if ($t->workflow_step) {
            $parts[] = 'Step '.(int) $t->workflow_step;
        }

        $line = implode(' · ', array_filter($parts));

        return $line !== '' ? $line : (string) $t->title;
    }

    public function activity(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $taskIds = Task::query()
            ->where('assigned_to', $userId)
            ->pluck('id');

        if ($taskIds->isEmpty()) {
            return response()->json([]);
        }

        $rows = ActivityLog::query()
            ->with(['user:id,name,email,role'])
            ->where('subject_type', Task::class)
            ->whereIn('subject_id', $taskIds)
            ->orderByDesc('created_at')
            ->limit(25)
            ->get();

        return response()->json($rows->map(function (ActivityLog $log): array {
            return [
                'id' => $log->id,
                'action' => $log->action,
                'subject_id' => $log->subject_id,
                'properties' => $log->properties,
                'created_at' => $log->created_at?->toIso8601String(),
                'user' => $log->user
                    ? $log->user->only(['id', 'name', 'email', 'role'])
                    : null,
            ];
        }));
    }

    public function update(Request $request, Task $task): JsonResponse
    {
        if ($task->assigned_to !== $request->user()->id) {
            abort(403, 'This task is not assigned to you.');
        }

        $data = $request->validate([
            'status' => ['sometimes', 'string', 'in:todo,doing,review,revision'],
            'description' => ['nullable', 'string'],
            'submission_link' => ['nullable', 'url', 'max:2048'],
            'submission_notes' => ['nullable', 'string'],
        ]);

        if (isset($data['status']) && $data['status'] === 'review') {
            $data['submitted_at'] = now();
        }

        if (isset($data['status']) && in_array($data['status'], ['todo', 'doing'], true)) {
            $data['reviewed_at'] = null;
        }

        $task->update($data);

        $userId = $request->user()->id;
        $allMine = Task::query()
            ->where('assigned_to', $userId)
            ->get();
        /** @var array<int, array<string, int>> $serviceProgress */
        $serviceProgress = [];
        /** @var array<int, array{index: int, total: int}> $taskUnitMeta */
        $taskUnitMeta = [];
        if ($allMine->isNotEmpty()) {
            [$serviceProgress, $taskUnitMeta] = $this->buildServiceUnitMaps($allMine, $userId);
        }
        $fresh = $task->fresh()->load(['project.client', 'assignee', 'agencyService', 'attachments.uploader']);
        $sid = (int) ($fresh->service_id ?? 0);

        return response()->json(
            $this->formatTask(
                $fresh,
                $sid > 0 ? ($serviceProgress[$sid] ?? null) : null,
                $taskUnitMeta[$fresh->id] ?? null
            )
        );
    }

    /**
     * Deliverables = billable units; tasks under each are workflow steps. Legacy rows without deliverable_id still map as units.
     *
     * @return array{0: array<int, array<string, int>>, 1: array<int, array{index: int, total: int}>}
     */
    private function buildServiceUnitMaps(Collection $userTasks, int $userId): array
    {
        if (! ServiceUnitSync::workflowColumnsExist()) {
            return $this->buildServiceUnitMapsLegacy($userTasks, $userId);
        }

        $serviceIds = $userTasks->pluck('service_id')->filter()->unique()->values()->all();
        if ($serviceIds === []) {
            return [[], []];
        }

        $deliverablesByService = Deliverable::query()
            ->whereIn('service_id', $serviceIds)
            ->with('tasks')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->groupBy('service_id');

        $allWorkflowTasks = Task::query()
            ->whereIn('service_id', $serviceIds)
            ->whereNotNull('deliverable_id')
            ->get()
            ->groupBy('service_id');

        $serviceProgress = [];
        $taskUnitMeta = [];

        foreach ($serviceIds as $serviceId) {
            $svc = AgencyService::query()->find($serviceId);
            $planned = (int) ($svc?->planned_quantity ?? 0);
            $list = $deliverablesByService->get($serviceId, collect());
            $total = max($planned, $list->count());
            $completed = $list->filter(fn (Deliverable $d) => $d->isWorkflowComplete())->count();
            $allFor = $allWorkflowTasks->get($serviceId, collect());
            $unassigned = $allFor->whereNull('assigned_to')->count();
            $yours = $allFor->where('assigned_to', $userId)->count();
            $withOthers = $allFor
                ->whereNotNull('assigned_to')
                ->where('assigned_to', '!=', $userId)
                ->count();
            $serviceProgress[(int) $serviceId] = [
                'completed' => $completed,
                'total' => $total,
                'unassigned' => $unassigned,
                'yours' => $yours,
                'with_others' => $withOthers,
            ];

            foreach ($list->values() as $idx => $d) {
                foreach ($d->tasks as $t) {
                    $taskUnitMeta[$t->id] = [
                        'index' => $idx + 1,
                        'total' => $total,
                    ];
                }
            }

            $orphans = Task::query()
                ->where('service_id', $serviceId)
                ->whereNull('deliverable_id')
                ->orderBy('id')
                ->get();
            foreach ($orphans->values() as $idx => $t) {
                $taskUnitMeta[$t->id] = [
                    'index' => $idx + 1,
                    'total' => max($total, $orphans->count()),
                ];
            }
        }

        return [$serviceProgress, $taskUnitMeta];
    }

    /**
     * @return array{0: array<int, array<string, int>>, 1: array<int, array{index: int, total: int}>}
     */
    private function buildServiceUnitMapsLegacy(Collection $userTasks, int $userId): array
    {
        $serviceIds = $userTasks->pluck('service_id')->filter()->unique()->values()->all();
        if ($serviceIds === []) {
            return [[], []];
        }

        $allInServices = Task::query()
            ->whereIn('service_id', $serviceIds)
            ->with('agencyService')
            ->orderBy('id')
            ->get()
            ->groupBy('service_id');

        $serviceProgress = [];
        $taskUnitMeta = [];

        foreach ($serviceIds as $serviceId) {
            $allFor = $allInServices->get($serviceId);
            if ($allFor === null || $allFor->isEmpty()) {
                continue;
            }
            $allOrdered = $allFor->values();
            $first = $allOrdered->first();
            $planned = (int) ($first?->agencyService?->planned_quantity ?? 0);
            $n = $allOrdered->count();
            $total = max($planned, $n);
            $completed = $allFor->where('status', 'done')->count();
            $unassigned = $allFor->whereNull('assigned_to')->count();
            $yours = $allFor->where('assigned_to', $userId)->count();
            $withOthers = $allFor
                ->whereNotNull('assigned_to')
                ->where('assigned_to', '!=', $userId)
                ->count();
            $serviceProgress[(int) $serviceId] = [
                'completed' => $completed,
                'total' => $total,
                'unassigned' => $unassigned,
                'yours' => $yours,
                'with_others' => $withOthers,
            ];
            foreach ($allOrdered as $idx => $t) {
                $taskUnitMeta[$t->id] = [
                    'index' => $idx + 1,
                    'total' => $total,
                ];
            }
        }

        return [$serviceProgress, $taskUnitMeta];
    }

    /**
     * @return array<string, mixed>
     */
    private function formatTask(Task $task, ?array $serviceProgress = null, ?array $taskUnit = null): array
    {
        $row = $task->toArray();
        $row['agency_service'] = $task->relationLoaded('agencyService') && $task->agencyService
            ? $task->agencyService->only(['id', 'name', 'period_label', 'status', 'planned_quantity', 'unit_price'])
            : null;
        $row['service_progress'] = $serviceProgress;
        $row['service_unit'] = $taskUnit;
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
