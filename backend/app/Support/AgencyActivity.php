<?php

namespace App\Support;

use App\Models\ActivityLog;
use App\Models\User;

class AgencyActivity
{
    /**
     * @param  array<string, mixed>|null  $properties
     */
    public static function log(?User $user, string $action, ?string $subjectType = null, ?int $subjectId = null, ?array $properties = null): void
    {
        ActivityLog::query()->create([
            'user_id' => $user?->id,
            'action' => $action,
            'subject_type' => $subjectType,
            'subject_id' => $subjectId,
            'properties' => $properties,
        ]);
    }
}
