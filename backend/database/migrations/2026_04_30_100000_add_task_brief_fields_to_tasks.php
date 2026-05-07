<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('tasks', 'client_content')) {
            Schema::table('tasks', function (Blueprint $table) {
                $table->text('client_content')->nullable()->after('instructions');
            });
        }
        if (! Schema::hasColumn('tasks', 'reference_url')) {
            Schema::table('tasks', function (Blueprint $table) {
                $table->string('reference_url', 2048)->nullable()->after('client_content');
            });
        }
        if (Schema::hasColumn('tasks', 'instructions')) {
            // Help legacy tasks pass “brief” requirement when re-saved: copy description into empty instructions
            DB::table('tasks')
                ->whereNull('instructions')
                ->whereNotNull('description')
                ->update(['instructions' => DB::raw('description')]);
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('tasks', 'reference_url')) {
            Schema::table('tasks', function (Blueprint $table) {
                $table->dropColumn('reference_url');
            });
        }
        if (Schema::hasColumn('tasks', 'client_content')) {
            Schema::table('tasks', function (Blueprint $table) {
                $table->dropColumn('client_content');
            });
        }
    }
};
