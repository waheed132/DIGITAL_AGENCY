<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('username')->nullable()->unique()->after('name');
            $table->string('role', 32)->default('employee')->after('password');
            $table->boolean('is_active')->default(true)->after('role');
        });

        foreach (DB::table('users')->whereNull('username')->cursor() as $row) {
            $local = strstr((string) $row->email, '@', true) ?: 'user';
            $slug = strtolower(preg_replace('/[^a-zA-Z0-9_\-]/', '', $local)) ?: 'user';
            DB::table('users')->where('id', $row->id)->update(['username' => $slug.$row->id]);
        }

        Schema::table('users', function (Blueprint $table) {
            $table->string('username')->nullable(false)->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['username', 'role', 'is_active']);
        });
    }
};
