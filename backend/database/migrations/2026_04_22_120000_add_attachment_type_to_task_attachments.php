<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('task_attachments')) {
            return;
        }

        if (! Schema::hasColumn('task_attachments', 'attachment_type')) {
            Schema::table('task_attachments', function (Blueprint $table) {
                $table->string('attachment_type', 32)->default('submission')->after('uploaded_by');
            });
        }

        // Backfill existing rows so admin-provided files remain stable task assets.
        DB::statement("
            UPDATE task_attachments ta
            INNER JOIN users u ON u.id = ta.uploaded_by
            SET ta.attachment_type = CASE
                WHEN u.role = 'admin' THEN 'asset'
                ELSE 'submission'
            END
        ");
    }

    public function down(): void
    {
        if (! Schema::hasTable('task_attachments') || ! Schema::hasColumn('task_attachments', 'attachment_type')) {
            return;
        }

        Schema::table('task_attachments', function (Blueprint $table) {
            $table->dropColumn('attachment_type');
        });
    }
};

