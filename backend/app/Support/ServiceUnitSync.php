<?php

namespace App\Support;

use App\Models\AgencyService;
use App\Models\Deliverable;
use App\Models\Task;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Keeps deliverables (units) aligned with `planned_quantity`, each with a fixed workflow of tasks. */
class ServiceUnitSync
{
    public static function workflowColumnsExist(): bool
    {
        return Schema::hasColumn('tasks', 'deliverable_id');
    }

    /**
     * @return array{
     *     created: int,
     *     removed: int,
     *     created_deliverables: int,
     *     removed_deliverables: int,
     *     assignees_filled: int,
     *     minimum_planned: int
     * }
     */
    public static function sync(AgencyService $service): array
    {
        if (! self::workflowColumnsExist()) {
            return self::syncLegacyFlatUnits($service);
        }

        return DB::transaction(function () use ($service): array {
            $service->refresh();
            $projectId = (int) $service->project_id;
            $planned = max(0, (int) ($service->planned_quantity ?? 0));
            $createdT = 0;
            $removedT = 0;
            $createdD = 0;
            $removedD = 0;

            $deliverables = Deliverable::query()
                ->where('service_id', $service->id)
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get();

            $count = $deliverables->count();

            if ($planned > $count) {
                for ($i = $count + 1; $i <= $planned; $i++) {
                    $d = Deliverable::query()->create([
                        'service_id' => $service->id,
                        'title' => sprintf('%s #%d', $service->name, $i),
                        'sort_order' => $i,
                        'status' => Deliverable::STATUS_PENDING,
                    ]);
                    $createdD++;
                    foreach (AgencyWorkflow::stepTitles() as $idx => $title) {
                        $step = $idx + 1;
                        Task::query()->create([
                            'project_id' => $projectId,
                            'service_id' => $service->id,
                            'deliverable_id' => $d->id,
                            'workflow_step' => $step,
                            'title' => $title,
                            'deliverable_type' => 'workflow',
                            'description' => null,
                            'instructions' => self::stepInstructions($service, $d, $step, $planned),
                            'client_content' => null,
                            'reference_url' => null,
                            'status' => 'todo',
                            'priority' => 'medium',
                        ]);
                        $createdT++;
                    }
                    $d->syncStatusFromTasks();
                }
            } elseif ($planned < $count) {
                $need = $count - $planned;
                $candidates = $deliverables
                    ->filter(fn (Deliverable $d) => self::isDeliverableDeletable($d))
                    ->sortByDesc('id')
                    ->values();
                for ($i = 0; $i < $need && $i < $candidates->count(); $i++) {
                    $del = $candidates->get($i);
                    $removedT += $del->tasks()->count();
                    $del->delete();
                    $removedD++;
                }
            }

            foreach (
                Deliverable::query()
                    ->where('service_id', $service->id)
                    ->orderBy('sort_order')
                    ->orderBy('id')
                    ->get() as $d
            ) {
                $rep = self::ensureWorkflowTasks($service, $d, $projectId, $planned);
                $createdT += $rep['created'];
            }

            $assigneesFilled = self::backfillUnassignedAssignees($service->fresh());

            return [
                'created' => $createdT,
                'removed' => $removedT,
                'created_deliverables' => $createdD,
                'removed_deliverables' => $removedD,
                'assignees_filled' => $assigneesFilled,
                'minimum_planned' => self::minimumPlannedQuantity($service->fresh()),
            ];
        });
    }

    /**
     * Before DB migration: one task row per planned unit (no deliverables layer).
     *
     * @return array{
     *     created: int,
     *     removed: int,
     *     created_deliverables: int,
     *     removed_deliverables: int,
     *     assignees_filled: int,
     *     minimum_planned: int
     * }
     */
    private static function syncLegacyFlatUnits(AgencyService $service): array
    {
        return DB::transaction(function () use ($service): array {
            $service->refresh();
            $projectId = (int) $service->project_id;
            $planned = max(0, (int) ($service->planned_quantity ?? 0));
            $created = 0;
            $removed = 0;

            $existing = Task::query()
                ->where('project_id', $projectId)
                ->where('service_id', $service->id)
                ->orderBy('id')
                ->get();

            $count = $existing->count();

            if ($planned > $count) {
                for ($i = $count + 1; $i <= $planned; $i++) {
                    $scopeNote = trim((string) ($service->description ?? ''));
                    $instructions = $scopeNote !== ''
                        ? $scopeNote
                        : "Deliverable {$i} of {$planned} for \"{$service->name}\". Follow the client proposal.";

                    Task::query()->create([
                        'project_id' => $projectId,
                        'service_id' => $service->id,
                        'title' => sprintf('%s %d', $service->name, $i),
                        'deliverable_type' => 'other',
                        'description' => null,
                        'instructions' => $instructions,
                        'client_content' => null,
                        'reference_url' => null,
                        'status' => 'todo',
                        'priority' => 'medium',
                    ]);
                    $created++;
                }
            } elseif ($planned < $count) {
                $need = $count - $planned;
                $candidates = $existing
                    ->filter(fn (Task $t) => self::isDeletable($t))
                    ->sortByDesc('id')
                    ->values();
                for ($i = 0; $i < $need && $i < $candidates->count(); $i++) {
                    $candidates->get($i)->delete();
                    $removed++;
                }
            }

            $assigneesFilled = self::backfillUnassignedAssignees($service->fresh());

            return [
                'created' => $created,
                'removed' => $removed,
                'created_deliverables' => 0,
                'removed_deliverables' => 0,
                'assignees_filled' => $assigneesFilled,
                'minimum_planned' => self::minimumPlannedQuantity($service->fresh()),
            ];
        });
    }

    private static function stepInstructions(AgencyService $service, Deliverable $d, int $step, int $planned): string
    {
        $scope = trim((string) ($service->description ?? ''));
        $base = $scope !== ''
            ? $scope
            : "\"{$d->title}\" ({$step}/".AgencyWorkflow::stepCount().") for service \"{$service->name}\" — follow the client proposal.";

        return $base;
    }

    /**
     * @return array{created: int}
     */
    private static function ensureWorkflowTasks(AgencyService $service, Deliverable $d, int $projectId, int $planned): array
    {
        $created = 0;
        $titles = AgencyWorkflow::stepTitles();
        foreach ($titles as $idx => $title) {
            $step = $idx + 1;
            $exists = Task::query()
                ->where('deliverable_id', $d->id)
                ->where('workflow_step', $step)
                ->exists();
            if ($exists) {
                continue;
            }
            Task::query()->create([
                'project_id' => $projectId,
                'service_id' => $service->id,
                'deliverable_id' => $d->id,
                'workflow_step' => $step,
                'title' => $title,
                'deliverable_type' => 'workflow',
                'description' => null,
                'instructions' => self::stepInstructions($service, $d, $step, $planned),
                'client_content' => null,
                'reference_url' => null,
                'status' => 'todo',
                'priority' => 'medium',
            ]);
            $created++;
        }

        return ['created' => $created];
    }

    public static function isDeliverableDeletable(Deliverable $d): bool
    {
        $d->loadMissing(['tasks.attachments']);
        foreach ($d->tasks as $t) {
            if (! self::isDeletable($t)) {
                return false;
            }
        }

        return true;
    }

    /** Assigns unassigned workflow tasks when assignee is unique across the service or project has one employee member. */
    public static function backfillUnassignedAssignees(AgencyService $service): int
    {
        $projectId = (int) $service->project_id;
        $serviceId = (int) $service->id;

        $tasks = Task::query()
            ->where('project_id', $projectId)
            ->where('service_id', $serviceId)
            ->orderBy('id')
            ->get();

        if ($tasks->isEmpty()) {
            return 0;
        }

        if (! $tasks->contains(fn (Task $t) => $t->assigned_to === null)) {
            return 0;
        }

        $assigneeIds = $tasks->pluck('assigned_to')->filter()->map(fn ($v) => (int) $v)->unique()->values();
        if ($assigneeIds->count() === 1) {
            $uid = (int) $assigneeIds->first();
            if ($uid <= 0) {
                return 0;
            }
            $n = Task::query()
                ->where('project_id', $projectId)
                ->where('service_id', $serviceId)
                ->whereNull('assigned_to')
                ->update(['assigned_to' => $uid]);

            return (int) $n;
        }

        if ($assigneeIds->count() > 1) {
            return 0;
        }

        $service->load('project.members');
        $project = $service->project;
        if (! $project) {
            return 0;
        }

        $memberIds = $project->members()
            ->where('is_active', true)
            ->where('role', User::ROLE_EMPLOYEE)
            ->pluck('users.id')
            ->map(fn ($v) => (int) $v)
            ->values();

        if ($memberIds->count() !== 1) {
            return 0;
        }

        $uid = (int) $memberIds->first();
        if ($uid <= 0) {
            return 0;
        }

        return (int) Task::query()
            ->where('project_id', $projectId)
            ->where('service_id', $serviceId)
            ->whereNull('assigned_to')
            ->update(['assigned_to' => $uid]);
    }

    public static function minimumPlannedQuantity(AgencyService $service): int
    {
        $locked = 0;

        if (self::workflowColumnsExist()) {
            foreach (
                Deliverable::query()
                    ->where('service_id', $service->id)
                    ->orderBy('id')
                    ->get() as $d
            ) {
                if (! self::isDeliverableDeletable($d)) {
                    $locked++;
                }
            }

            foreach (
                Task::query()
                    ->where('project_id', $service->project_id)
                    ->where('service_id', $service->id)
                    ->whereNull('deliverable_id')
                    ->get() as $t
            ) {
                if (! self::isDeletable($t)) {
                    $locked++;
                }
            }

            return $locked;
        }

        foreach (
            Task::query()
                ->where('project_id', $service->project_id)
                ->where('service_id', $service->id)
                ->get() as $t
        ) {
            if (! self::isDeletable($t)) {
                $locked++;
            }
        }

        return $locked;
    }

    public static function isDeletable(Task $t): bool
    {
        if ($t->status !== 'todo') {
            return false;
        }
        if ($t->submitted_at) {
            return false;
        }
        if (! empty($t->submission_link)) {
            return false;
        }
        if ($t->relationLoaded('attachments') ? $t->attachments->isNotEmpty() : $t->attachments()->exists()) {
            return false;
        }

        return true;
    }
}
