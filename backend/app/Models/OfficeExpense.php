<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OfficeExpense extends Model
{
    /** @var list<string> */
    public const CATEGORIES = ['food', 'bills', 'transport', 'office', 'personal', 'other'];

    /**
     * @var list<string>
     */
    protected $fillable = [
        'title',
        'amount',
        'expense_date',
        'category',
        'assigned_to',
        'notes',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'expense_date' => 'date',
        ];
    }
}
