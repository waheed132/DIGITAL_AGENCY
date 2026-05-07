<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('services')) {
            return;
        }

        if (! Schema::hasColumn('services', 'planned_quantity')) {
            Schema::table('services', function (Blueprint $table) {
                $table->unsignedInteger('planned_quantity')->default(0)->after('name');
            });
        }

        if (! Schema::hasColumn('services', 'unit_price')) {
            Schema::table('services', function (Blueprint $table) {
                $table->decimal('unit_price', 15, 2)->default(0)->after('planned_quantity');
            });
        }

        DB::table('services')->whereNull('planned_quantity')->update(['planned_quantity' => 0]);
        DB::table('services')->whereNull('unit_price')->update(['unit_price' => 0]);
    }

    public function down(): void
    {
        if (! Schema::hasTable('services')) {
            return;
        }

        $drop = [];
        if (Schema::hasColumn('services', 'planned_quantity')) {
            $drop[] = 'planned_quantity';
        }
        if (Schema::hasColumn('services', 'unit_price')) {
            $drop[] = 'unit_price';
        }

        if ($drop !== []) {
            Schema::table('services', function (Blueprint $table) use ($drop) {
                $table->dropColumn($drop);
            });
        }
    }
};

