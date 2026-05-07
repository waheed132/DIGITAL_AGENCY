<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OfficeExpenseAdvance extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'assignee_key',
        'amount',
        'advance_date',
        'notes',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'advance_date' => 'date',
        ];
    }
}
