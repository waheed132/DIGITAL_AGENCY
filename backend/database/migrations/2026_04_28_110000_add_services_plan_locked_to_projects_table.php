<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('projects') || Schema::hasColumn('projects', 'services_plan_locked')) {
            return;
        }

        Schema::table('projects', function (Blueprint $table) {
            $table->boolean('services_plan_locked')->default(false)->after('deadline');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('projects') || ! Schema::hasColumn('projects', 'services_plan_locked')) {
            return;
        }

        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn('services_plan_locked');
        });
    }
};

