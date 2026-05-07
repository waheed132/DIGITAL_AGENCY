<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Project extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'client_id',
        'name',
        'description',
        'status',
        'priority',
        'deadline',
        'services_plan_locked',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'deadline' => 'date',
            'services_plan_locked' => 'boolean',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class)->withTimestamps();
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class);
    }

    public function agencyServices(): HasMany
    {
        return $this->hasMany(AgencyService::class, 'project_id');
    }

    public function projectInvoice(): HasOne
    {
        return $this->hasOne(Invoice::class, 'project_id')
            ->where('scope', Invoice::SCOPE_PROJECT);
    }
}
