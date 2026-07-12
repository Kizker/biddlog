<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('reserve_items')) {
            Schema::create('reserve_items', function (Blueprint $table) {
            $table->id();
            $table->string('item_code');
            $table->string('grade', 10);
            $table->integer('max_price');
            $table->string('unit_info')->nullable();
            $table->timestamps();
        });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('reserve_items');
    }
};
