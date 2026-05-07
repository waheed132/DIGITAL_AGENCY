<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ClientIntakeInvite extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'token',
        'label',
        'expires_at',
        'consumed_at',
        'created_by',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'consumed_at' => 'datetime',
        ];
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function intakes(): HasMany
    {
        return $this->hasMany(ClientIntake::class, 'invite_id');
    }
}
