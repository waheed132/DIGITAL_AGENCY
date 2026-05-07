<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('office_expense_advances')) {
            return;
        }

        Schema::create('office_expense_advances', function (Blueprint $table) {
            $table->id();
            $table->string('assignee_key', 32);
            $table->decimal('amount', 15, 2);
            $table->date('advance_date');
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('office_expense_advances');
    }
};
