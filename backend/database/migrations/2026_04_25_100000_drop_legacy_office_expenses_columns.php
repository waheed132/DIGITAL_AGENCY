<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Removes legacy columns (due_date, type, status) left from an older schema.
 * When due_date is NOT NULL without a default, inserts that only set expense_date fail (MySQL 1364).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('office_expenses')) {
            return;
        }

        if (Schema::hasColumn('office_expenses', 'due_date')
            && Schema::hasColumn('office_expenses', 'expense_date')) {
            DB::statement(
                'UPDATE office_expenses SET expense_date = due_date WHERE expense_date IS NULL AND due_date IS NOT NULL'
            );
        }

        $legacy = collect(['due_date', 'type', 'status'])
            ->filter(fn (string $c) => Schema::hasColumn('office_expenses', $c))
            ->values()
            ->all();

        if ($legacy !== []) {
            Schema::table('office_expenses', function (Blueprint $table) use ($legacy) {
                $table->dropColumn($legacy);
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('office_expenses')) {
            return;
        }

        Schema::table('office_expenses', function (Blueprint $table) {
            if (! Schema::hasColumn('office_expenses', 'due_date')) {
                $table->date('due_date')->nullable()->after('amount');
            }
            if (! Schema::hasColumn('office_expenses', 'type')) {
                $table->string('type', 32)->default('misc')->after('due_date');
            }
            if (! Schema::hasColumn('office_expenses', 'status')) {
                $table->string('status', 16)->default('paid')->after('type');
            }
        });
    }
};
