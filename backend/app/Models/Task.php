<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Schema;

class Task extends Model
{
    protected static function booted(): void
    {
        static::saved(function (Task $task): void {
            if (! Schema::hasColumn('tasks', 'deliverable_id')) {
                return;
            }
            if ($task->deliverable_id) {
                Deliverable::query()->whereKey($task->deliverable_id)->first()?->syncStatusFromTasks();
            }
        });
    }

    /**
     * @var list<string>
     */
    protected $fillable = [
        'project_id',
        'service_id',
        'deliverable_id',
        'workflow_step',
        'assigned_to',
        'title',
        'deliverable_type',
        'description',
        'instructions',
        'client_content',
        'reference_url',
        'status',
        'priority',
        'deadline',
        'submitted_at',
        'submission_link',
        'submission_notes',
        'admin_feedback',
        'reviewed_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'deadline' => 'datetime',
            'submitted_at' => 'datetime',
            'reviewed_at' => 'datetime',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function agencyService(): BelongsTo
    {
        return $this->belongsTo(AgencyService::class, 'service_id');
    }

    public function deliverable(): BelongsTo
    {
        return $this->belongsTo(Deliverable::class, 'deliverable_id');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(TaskAttachment::class)->latest();
    }
}
