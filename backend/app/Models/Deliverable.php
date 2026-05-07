<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Deliverable extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_IN_PROGRESS = 'in_progress';

    public const STATUS_IN_REVIEW = 'in_review';

    public const STATUS_REVISION = 'revision';

    public const STATUS_SUBMITTED = 'submitted';

    public const STATUS_APPROVED = 'approved';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'service_id',
        'sort_order',
        'title',
        'description',
        'status',
        'submission_url',
        'internal_notes',
        'submitted_at',
        'approved_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'submitted_at' => 'datetime',
            'approved_at' => 'datetime',
        ];
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(AgencyService::class, 'service_id');
    }

    /**
     * @return HasMany<Task, $this>
     */
    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class, 'deliverable_id')->orderBy('workflow_step');
    }

    public function isWorkflowComplete(): bool
    {
        $tasks = $this->tasks;
        if ($tasks->isEmpty()) {
            return false;
        }

        return $tasks->every(fn (Task $t) => $t->status === 'done');
    }

    public function syncStatusFromTasks(): void
    {
        $tasks = $this->tasks()->orderBy('workflow_step')->get();
        if ($tasks->isEmpty()) {
            if ($this->status !== self::STATUS_PENDING) {
                $this->update(['status' => self::STATUS_PENDING]);
            }

            return;
        }

        if ($tasks->every(fn (Task $t) => $t->status === 'done')) {
            $this->update(['status' => self::STATUS_APPROVED]);

            return;
        }

        if ($this->status === self::STATUS_SUBMITTED || $this->status === self::STATUS_APPROVED) {
            return;
        }

        $current = $tasks->first(fn (Task $t) => $t->status !== 'done');
        if (! $current instanceof Task) {
            return;
        }

        $step = (int) ($current->workflow_step ?? 1);
        $status = match (true) {
            $step <= 2 => self::STATUS_IN_PROGRESS,
            $step === 3 => self::STATUS_IN_REVIEW,
            $step === 4 => self::STATUS_REVISION,
            default => self::STATUS_IN_PROGRESS,
        };

        if ($this->status !== $status) {
            $this->update(['status' => $status]);
        }
    }

    public static function statusLabel(string $status): string
    {
        return match ($status) {
            self::STATUS_PENDING => 'Pending',
            self::STATUS_IN_PROGRESS => 'In progress',
            self::STATUS_IN_REVIEW => 'In review',
            self::STATUS_REVISION => 'Revision',
            self::STATUS_SUBMITTED => 'Submitted',
            self::STATUS_APPROVED => 'Approved',
            default => ucfirst(str_replace('_', ' ', $status)),
        };
    }
}
