<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\OfficeExpenseAdvance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class OfficeExpenseAdvanceController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $keys = collect(config('office_expenses.assignees', []))
            ->pluck('key')
            ->filter()
            ->values()
            ->all();

        $data = $request->validate([
            'assignee_key' => ['required', 'string', Rule::in($keys)],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'advance_date' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);

        $advance = OfficeExpenseAdvance::query()->create($data);

        return response()->json([
            'id' => $advance->id,
            'assignee_key' => $advance->assignee_key,
            'amount' => (string) $advance->amount,
            'advance_date' => $advance->advance_date?->toDateString(),
            'notes' => $advance->notes,
        ], 201);
    }
}
