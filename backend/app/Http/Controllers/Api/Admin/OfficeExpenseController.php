<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\OfficeExpense;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class OfficeExpenseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $rows = OfficeExpense::query()
            ->orderByDesc('expense_date')
            ->orderByDesc('id')
            ->get();

        $now = Carbon::now();
        $today = $now->toDateString();
        $y = (int) $now->year;
        $m = (int) $now->month;

        $weekStart = $now->copy()->startOfWeek(Carbon::MONDAY)->toDateString();
        $weekEnd = $now->copy()->endOfWeek(Carbon::SUNDAY)->toDateString();

        $todayTotal = (string) OfficeExpense::query()->whereDate('expense_date', $today)->sum('amount');
        $weekTotal = (string) OfficeExpense::query()
            ->whereBetween('expense_date', [$weekStart, $weekEnd])
            ->sum('amount');
        $monthTotal = (string) OfficeExpense::query()
            ->whereYear('expense_date', $y)
            ->whereMonth('expense_date', $m)
            ->sum('amount');

        $viewerKey = $this->viewerAssigneeKey($request->user());

        return response()->json([
            'expenses' => $rows->map(fn (OfficeExpense $e) => $this->toResource($e)),
            'summary' => [
                'today_total' => $todayTotal,
                'week_total' => $weekTotal,
                'month_total' => $monthTotal,
            ],
            'team_balances' => $this->teamBalances(),
            'meta' => [
                'assignees' => config('office_expenses.assignees', []),
                'viewer_assignee_key' => $viewerKey,
            ],
        ]);
    }

    /**
     * Remaining = sum(advances) − sum(expenses) per assignee key.
     *
     * @return list<array{assignee_key: string, label: string, advances_total: string, spent_total: string, remaining: string}>
     */
    private function teamBalances(): array
    {
        $assignees = config('office_expenses.assignees', []);

        $advanceSums = Schema::hasTable('office_expense_advances')
            ? DB::table('office_expense_advances')
                ->selectRaw('assignee_key, COALESCE(SUM(amount), 0) as t')
                ->groupBy('assignee_key')
                ->pluck('t', 'assignee_key')
            : collect();

        $spentSums = OfficeExpense::query()
            ->selectRaw("COALESCE(assigned_to, 'me') as ak, COALESCE(SUM(amount), 0) as t")
            ->groupByRaw("COALESCE(assigned_to, 'me')")
            ->get()
            ->mapWithKeys(fn ($r) => [(string) $r->ak => (float) $r->t]);

        $out = [];
        foreach ($assignees as $row) {
            $key = $row['key'];
            $adv = (float) ($advanceSums->get($key) ?? 0.0);
            $sp = (float) ($spentSums[$key] ?? 0.0);
            $rem = $adv - $sp;
            $out[] = [
                'assignee_key' => $key,
                'label' => $row['label'],
                'advances_total' => number_format($adv, 2, '.', ''),
                'spent_total' => number_format($sp, 2, '.', ''),
                'remaining' => number_format($rem, 2, '.', ''),
            ];
        }

        return $out;
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        if (! isset($data['assigned_to']) || $data['assigned_to'] === null || $data['assigned_to'] === '') {
            $data['assigned_to'] = $this->viewerAssigneeKey($request->user());
        }
        $expense = OfficeExpense::query()->create($data);

        return response()->json($this->toResource($expense), 201);
    }

    public function update(Request $request, OfficeExpense $office_expense): JsonResponse
    {
        $data = $this->validated($request);
        if (! array_key_exists('assigned_to', $data) || $data['assigned_to'] === null || $data['assigned_to'] === '') {
            $data['assigned_to'] = $office_expense->assigned_to ?? 'me';
        }
        $office_expense->update($data);

        return response()->json($this->toResource($office_expense->fresh()));
    }

    public function destroy(OfficeExpense $office_expense): JsonResponse
    {
        $office_expense->delete();

        return response()->json(['ok' => true]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        if ($request->input('category') === '') {
            $request->merge(['category' => null]);
        }

        $keys = collect(config('office_expenses.assignees', []))
            ->pluck('key')
            ->filter()
            ->values()
            ->all();

        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:0'],
            'expense_date' => ['required', 'date'],
            'category' => ['nullable', 'string', Rule::in(OfficeExpense::CATEGORIES)],
            'assigned_to' => ['nullable', 'string', Rule::in($keys)],
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);
        $c = $data['category'] ?? null;
        $data['category'] = ($c !== null && $c !== '') ? $c : 'other';

        return $data;
    }

    private function viewerAssigneeKey(?User $user): string
    {
        if ($user === null) {
            return 'me';
        }
        $map = config('office_expenses.username_to_assignee', []);
        $u = strtolower($user->username);

        return $map[$u] ?? 'me';
    }

    /**
     * @return array<string, mixed>
     */
    private function toResource(OfficeExpense $e): array
    {
        return [
            'id' => $e->id,
            'title' => $e->title,
            'amount' => (string) $e->amount,
            'expense_date' => $e->expense_date?->toDateString(),
            'category' => $e->category ?? 'other',
            'assigned_to' => $e->assigned_to ?? 'me',
            'notes' => $e->notes,
            'created_at' => $e->created_at?->toIso8601String(),
            'updated_at' => $e->updated_at?->toIso8601String(),
        ];
    }
}
