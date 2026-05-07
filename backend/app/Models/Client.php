<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Client extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'source_intake_id',
        'name',
        'company',
        'email',
        'phone',
        'website',
        'address',
        'brand_primary',
        'brand_secondary',
        'brand_colors',
        'logo_path',
        'business_profile_pdf_path',
        'notes',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'brand_colors' => 'array',
    ];

    /**
     * Public API shape (no raw storage paths). Used by admin + team task views.
     *
     * @return array<string, mixed>
     */
    public function toApiArray(): array
    {
        $colors = $this->normalizedBrandColors();

        return [
            'id' => $this->id,
            'source_intake_id' => $this->source_intake_id,
            'name' => $this->name,
            'company' => $this->company,
            'email' => $this->email,
            'phone' => $this->phone,
            'website' => $this->website,
            'address' => $this->address,
            'brand_primary' => $this->brand_primary,
            'brand_secondary' => $this->brand_secondary,
            'brand_colors' => count($colors) > 0 ? $colors : null,
            'notes' => $this->notes,
            'logo_url' => $this->logo_path ? '/api/client-files/'.$this->id.'/logo' : null,
            'business_profile_url' => $this->business_profile_pdf_path
                ? '/api/client-files/'.$this->id.'/business-profile'
                : null,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }

    /**
     * Full palette for the UI; falls back to legacy two-column fields.
     *
     * @return list<string>
     */
    public function normalizedBrandColors(): array
    {
        $fromJson = $this->brand_colors;
        if (is_array($fromJson) && count($fromJson) > 0) {
            return array_values(array_filter(array_map(function ($c) {
                return is_string($c) && trim($c) !== '' ? trim($c) : null;
            }, $fromJson)));
        }

        return array_values(array_filter([
            $this->brand_primary,
            $this->brand_secondary,
        ], fn ($v) => is_string($v) && trim($v) !== ''));
    }

    public function sourceIntake(): BelongsTo
    {
        return $this->belongsTo(ClientIntake::class, 'source_intake_id');
    }

    public function projects(): HasMany
    {
        return $this->hasMany(Project::class);
    }
}
