<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('client_intakes', function (Blueprint $table) {
            $table->foreignId('invite_id')
                ->nullable()
                ->after('id')
                ->constrained('client_intake_invites')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('client_intakes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('invite_id');
        });
    }
};
