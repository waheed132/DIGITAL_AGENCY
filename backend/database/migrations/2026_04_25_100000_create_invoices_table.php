<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->string('invoice_key', 64)->unique();
            $table->string('invoice_number', 32)->nullable()->unique();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignId('agency_service_id')->nullable()->constrained('services')->nullOnDelete();
            $table->string('scope', 16);
            $table->string('status', 16)->default('draft');
            $table->decimal('amount', 15, 2);
            $table->string('currency', 3)->default('PKR');
            $table->json('line_items');
            $table->string('client_name')->nullable();
            $table->string('client_email')->nullable();
            $table->string('agency_name')->nullable();
            $table->text('footer_notes')->nullable();
            $table->date('due_date')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->string('pdf_path', 512)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoices');
    }
};
