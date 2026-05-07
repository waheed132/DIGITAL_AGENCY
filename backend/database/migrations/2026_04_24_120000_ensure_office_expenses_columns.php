<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Aligns existing `office_expenses` tables that were created manually or from an older
 * schema so they match OfficeExpense model expectations (expense_date, category, notes).
 */
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
            });
        }

        if (! Schema::hasColumn('office_expenses', 'category')) {
            Schema::table('office_expenses', function (Blueprint $table) {
                $table->string('category', 32)->default('other')->nullable()->after('expense_date');
            });
        }

        if (! Schema::hasColumn('office_expenses', 'notes')) {
            Schema::table('office_expenses', function (Blueprint $table) {
                $table->text('notes')->nullable()->after('category');
            });
        }

        if (Schema::hasColumn('office_expenses', 'due_date')) {
            DB::statement(
                'UPDATE office_expenses SET expense_date = due_date WHERE expense_date IS NULL AND due_date IS NOT NULL'
            );
        }

        $today = Carbon::now()->toDateString();
        DB::table('office_expenses')->whereNull('expense_date')->update(['expense_date' => $today]);

        DB::table('office_expenses')->whereNull('category')->update(['category' => 'other']);

        if (Schema::hasColumn('office_expenses', 'expense_date')) {
            DB::statement('ALTER TABLE office_expenses MODIFY expense_date DATE NOT NULL');
        }

        if (Schema::hasColumn('office_expenses', 'category')) {
            DB::statement(
                "ALTER TABLE office_expenses MODIFY category VARCHAR(32) NOT NULL DEFAULT 'other'"
            );
        }
    }

    public function down(): void
    {
        // Non-destructive repair migration: do not drop columns on rollback.
    }
};
