<?php

use App\Models\AgencyService;
use App\Models\Deliverable;
use App\Models\Task;
use App\Support\AgencyWorkflow;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deliverables', function (Blueprint $table): void {
            if (! Schema::hasColumn('deliverables', 'sort_order')) {
                $table->unsignedSmallInteger('sort_order')->default(0)->after('service_id');
            }
        });

        Schema::table('tasks', function (Blueprint $table): void {
            if (! Schema::hasColumn('tasks', 'deliverable_id')) {
                $table->foreignId('deliverable_id')
                    ->nullable()
                    ->after('service_id')
                    ->constrained('deliverables')
                    ->cascadeOnDelete();
            }
            if (! Schema::hasColumn('tasks', 'workflow_step')) {
                $table->unsignedTinyInteger('workflow_step')->nullable()->after('deliverable_id');
            }
        });

        $titles = AgencyWorkflow::stepTitles();

        Task::query()
            ->whereNotNull('service_id')
            ->whereNull('deliverable_id')
            ->orderBy('service_id')
            ->orderBy('id')
            ->each(function (Task $task) use ($titles): void {
                $service = AgencyService::query()->find($task->service_id);
                if (! $service) {
                    return;
                }

                $nextSort = (int) (Deliverable::query()->where('service_id', $service->id)->max('sort_order') ?? 0) + 1;

                $d = Deliverable::query()->create([
                    'service_id' => $service->id,
                    'title' => $task->title,
                    'sort_order' => $nextSort > 0 ? $nextSort : 1,
                    'status' => $task->status === 'done' ? Deliverable::STATUS_APPROVED : Deliverable::STATUS_PENDING,
                ]);

                if ($task->status === 'done') {
                    $task->update([
                        'deliverable_id' => $d->id,
                        'workflow_step' => 5,
                        'title' => $titles[4],
                    ]);
                    for ($s = 1; $s <= 4; $s++) {
                        Task::query()->create([
                            'project_id' => $task->project_id,
                            'service_id' => $task->service_id,
                            'deliverable_id' => $d->id,
                            'workflow_step' => $s,
                            'assigned_to' => $task->assigned_to,
                            'title' => $titles[$s - 1],
                            'deliverable_type' => 'workflow',
                            'description' => null,
                            'instructions' => 'Completed as part of migrated unit.',
                            'client_content' => null,
                            'reference_url' => null,
                            'status' => 'done',
                            'priority' => $task->priority ?? 'medium',
                        ]);
                    }

                    return;
                }

                $task->update([
                    'deliverable_id' => $d->id,
                    'workflow_step' => 1,
                    'title' => $titles[0],
                    'deliverable_type' => 'workflow',
                ]);

                for ($s = 2; $s <= 5; $s++) {
                    Task::query()->create([
                        'project_id' => $task->project_id,
                        'service_id' => $task->service_id,
                        'deliverable_id' => $d->id,
                        'workflow_step' => $s,
                        'assigned_to' => null,
                        'title' => $titles[$s - 1],
                        'deliverable_type' => 'workflow',
                        'description' => null,
                        'instructions' => 'Workflow step for '.$d->title.'.',
                        'client_content' => null,
                        'reference_url' => null,
                        'status' => 'todo',
                        'priority' => 'medium',
                    ]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table): void {
            if (Schema::hasColumn('tasks', 'workflow_step')) {
                $table->dropColumn('workflow_step');
            }
            if (Schema::hasColumn('tasks', 'deliverable_id')) {
                $table->dropConstrainedForeignId('deliverable_id');
            }
        });

        Schema::table('deliverables', function (Blueprint $table): void {
            if (Schema::hasColumn('deliverables', 'sort_order')) {
                $table->dropColumn('sort_order');
            }
        });
    }
};
