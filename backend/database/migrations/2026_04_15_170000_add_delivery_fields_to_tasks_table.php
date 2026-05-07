<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('tasks', 'deliverable_type')) {
            Schema::table('tasks', function (Blueprint $table) {
                $table->string('deliverable_type', 64)->default('other')->after('title');
            });
        }
        if (! Schema::hasColumn('tasks', 'submission_link')) {
            Schema::table('tasks', function (Blueprint $table) {
                $table->string('submission_link')->nullable()->after('submitted_at');
            });
        }
        if (! Schema::hasColumn('tasks', 'submission_notes')) {
            Schema::table('tasks', function (Blueprint $table) {
                $table->text('submission_notes')->nullable()->after('submission_link');
            });
        }
        if (! Schema::hasColumn('tasks', 'admin_feedback')) {
            Schema::table('tasks', function (Blueprint $table) {
                $table->text('admin_feedback')->nullable()->after('submission_notes');
            });
        }
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropColumn([
                'deliverable_type',
                'submission_link',
                'submission_notes',
                'admin_feedback',
            ]);
        });
    }
};
