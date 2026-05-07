<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class AgencyService extends Model
{
    protected $table = 'services';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'project_id',
        'name',
        'planned_quantity',
        'unit_price',
        'period_label',
        'description',
        'status',
        'sort_order',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'planned_quantity' => 'integer',
            'unit_price' => 'decimal:2',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class, 'service_id');
    }

    public function deliverables(): HasMany
    {
        return $this->hasMany(Deliverable::class, 'service_id');
    }

    public function invoice(): HasOne
    {
        return $this->hasOne(Invoice::class, 'agency_service_id')
            ->where('scope', Invoice::SCOPE_SERVICE);
    }
}
