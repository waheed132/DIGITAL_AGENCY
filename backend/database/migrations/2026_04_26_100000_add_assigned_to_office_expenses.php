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

        if (Schema::hasColumn('office_expenses', 'assigned_to')) {
            return;
        }

        Schema::table('office_expenses', function (Blueprint $table) {
            $table->string('assigned_to', 32)->default('me')->after('category');
        });

        DB::table('office_expenses')->update(['assigned_to' => 'me']);
    }

    public function down(): void
    {
        if (! Schema::hasTable('office_expenses') || ! Schema::hasColumn('office_expenses', 'assigned_to')) {
            return;
        }

        Schema::table('office_expenses', function (Blueprint $table) {
            $table->dropColumn('assigned_to');
        });
    }
};
