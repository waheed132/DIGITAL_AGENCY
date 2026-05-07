<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('client_intakes', function (Blueprint $table) {
            $table->id();
            $table->json('payload');
            $table->string('summary_brand_name')->index();
            $table->string('status', 32)->default('pending')->index();
            $table->foreignId('client_id')->nullable()->constrained('clients')->nullOnDelete();
            $table->text('admin_note')->nullable();
            $table->foreignId('submitted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_intakes');
    }
};
