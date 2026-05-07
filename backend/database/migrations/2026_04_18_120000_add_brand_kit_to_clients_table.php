<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->string('website')->nullable()->after('phone');
            $table->text('address')->nullable()->after('website');
            $table->string('brand_primary', 7)->nullable()->after('address');
            $table->string('brand_secondary', 7)->nullable()->after('brand_primary');
            $table->string('logo_path')->nullable()->after('brand_secondary');
            $table->string('business_profile_pdf_path')->nullable()->after('logo_path');
        });
    }

    public function down(): void
    {
        Schema::table('clients', function (Blueprint $table) {
            $table->dropColumn([
                'website',
                'address',
                'brand_primary',
                'brand_secondary',
                'logo_path',
                'business_profile_pdf_path',
            ]);
        });
    }
};
