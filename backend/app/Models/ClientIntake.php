<?php

namespace App\Models;

use App\Services\IntakeToClientMapper;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientIntake extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_REJECTED = 'rejected';

    public const STATUS_CONVERTED = 'converted';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'invite_id',
        'payload',
        'summary_brand_name',
        'status',
        'client_id',
        'admin_note',
        'submitted_by',
        'reviewed_by',
        'reviewed_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'reviewed_at' => 'datetime',
        ];
    }

    public function invite(): BelongsTo
    {
        return $this->belongsTo(ClientIntakeInvite::class, 'invite_id');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function submittedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    /**
     * @return array<string, mixed>
     */
    public function toListArray(): array
    {
        $payload = is_array($this->payload) ? $this->payload : [];

        return [
            'id' => $this->id,
            'summary_brand_name' => $this->summary_brand_name,
            'contact_email' => IntakeToClientMapper::normalizeEmail($payload['contactEmail'] ?? null),
            'status' => $this->status,
            'client_id' => $this->client_id,
            'invite_id' => $this->invite_id,
            'invite_label' => $this->relationLoaded('invite') && $this->invite ? $this->invite->label : null,
            'created_at' => $this->created_at?->toIso8601String(),
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function toDetailArray(): array
    {
        return array_merge($this->toListArray(), [
            'payload' => $this->payload,
            'admin_note' => $this->admin_note,
            'invite' => $this->relationLoaded('invite') && $this->invite
                ? ['id' => $this->invite->id, 'label' => $this->invite->label]
                : null,
            'submitted_by' => $this->relationLoaded('submittedBy') && $this->submittedBy
                ? $this->submittedBy->only(['id', 'name', 'email'])
                : null,
            'reviewed_by' => $this->relationLoaded('reviewedBy') && $this->reviewedBy
                ? $this->reviewedBy->only(['id', 'name', 'email'])
                : null,
        ]);
    }
}
