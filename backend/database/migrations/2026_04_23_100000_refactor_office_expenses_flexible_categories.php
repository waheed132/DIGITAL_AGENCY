<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('office_expenses')) {
            return;
        }

        if (! Schema::hasColumn('office_expenses', 'expense_date')) {
            Schema::table('office_expenses', function (Blueprint $table) {
                $table->date('expense_date')->nullable()->after('amount');
                $table->string('category', 32)->default('other')->after('expense_date');
            });

            $rows = DB::table('office_expenses')->get();
            foreach ($rows as $row) {
                $category = 'other';
                if (isset($row->type) && $row->type) {
                    $category = match ($row->type) {
                        'electricity', 'internet', 'rent' => 'bills',
                        'salaries' => 'office',
                        default => 'other',
                    };
                }
                DB::table('office_expenses')->where('id', $row->id)->update([
                    'expense_date' => $row->due_date ?? date('Y-m-d'),
                    'category' => $category,
                ]);
            }
        }

        $legacy = collect(['due_date', 'type', 'status'])
            ->filter(fn (string $c) => Schema::hasColumn('office_expenses', $c))
            ->values()
            ->all();
        if ($legacy !== []) {
            if (Schema::hasColumn('office_expenses', 'due_date')
                && Schema::hasColumn('office_expenses', 'expense_date')) {
                DB::statement(
                    'UPDATE office_expenses SET expense_date = due_date WHERE expense_date IS NULL AND due_date IS NOT NULL'
                );
            }
            DB::table('office_expenses')->whereNull('expense_date')->update(['expense_date' => date('Y-m-d')]);

            Schema::table('office_expenses', function (Blueprint $table) use ($legacy) {
                $table->dropColumn($legacy);
            });
        }

        if (Schema::hasColumn('office_expenses', 'expense_date')) {
            DB::statement('ALTER TABLE office_expenses MODIFY expense_date DATE NOT NULL');
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('office_expenses') || ! Schema::hasColumn('office_expenses', 'expense_date')) {
            return;
        }

        Schema::table('office_expenses', function (Blueprint $table) {
            $table->date('due_date')->nullable()->after('amount');
            $table->string('type', 32)->default('misc')->after('due_date');
            $table->string('status', 16)->default('paid')->after('type');
        });

        DB::table('office_expenses')->update([
            'due_date' => DB::raw('expense_date'),
            'type' => 'misc',
            'status' => 'paid',
        ]);

        Schema::table('office_expenses', function (Blueprint $table) {
            $table->dropColumn(['expense_date', 'category']);
        });
    }
};
