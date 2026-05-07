<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Invoice extends Model
{
    public const SCOPE_SERVICE = 'service';

    public const SCOPE_PROJECT = 'project';

    public const STATUS_DRAFT = 'draft';

    public const STATUS_SENT = 'sent';

    public const STATUS_PAID = 'paid';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'invoice_key',
        'invoice_number',
        'project_id',
        'agency_service_id',
        'scope',
        'status',
        'amount',
        'currency',
        'line_items',
        'client_name',
        'client_email',
        'agency_name',
        'footer_notes',
        'due_date',
        'sent_at',
        'paid_at',
        'pdf_path',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'line_items' => 'array',
            'amount' => 'decimal:2',
            'due_date' => 'date',
            'sent_at' => 'datetime',
            'paid_at' => 'datetime',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function agencyService(): BelongsTo
    {
        return $this->belongsTo(AgencyService::class, 'agency_service_id');
    }

    public function displayStatus(): string
    {
        if ($this->status === self::STATUS_PAID) {
            return 'paid';
        }
        if ($this->status === self::STATUS_DRAFT) {
            return 'draft';
        }
        if ($this->status === self::STATUS_SENT && $this->due_date && $this->due_date->isPast() && $this->paid_at === null) {
            return 'overdue';
        }

        return $this->status === self::STATUS_SENT ? 'sent' : $this->status;
    }

    public function toApiArray(): array
    {
        return [
            'id' => $this->id,
            'invoice_key' => $this->invoice_key,
            'invoice_number' => $this->invoice_number,
            'project_id' => $this->project_id,
            'agency_service_id' => $this->agency_service_id,
            'scope' => $this->scope,
            'status' => $this->status,
            'status_display' => $this->displayStatus(),
            'amount' => (string) $this->amount,
            'currency' => $this->currency,
            'line_items' => $this->line_items,
            'client_name' => $this->client_name,
            'client_email' => $this->client_email,
            'due_date' => $this->due_date?->toDateString(),
            'sent_at' => $this->sent_at?->toIso8601String(),
            'paid_at' => $this->paid_at?->toIso8601String(),
            'has_pdf' => $this->pdf_path !== null,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
