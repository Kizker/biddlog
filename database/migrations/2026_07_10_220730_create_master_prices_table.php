<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('master_prices')) {
            Schema::create('master_prices', function (Blueprint $table) {
            $table->id();
            $table->string('item_code');
            $table->string('grade', 10);
            $table->integer('max_price');
            $table->foreignId('bidder_id')->nullable()->constrained('bidders')->nullOnDelete();
            $table->timestamps();
        });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('master_prices');
    }
};
