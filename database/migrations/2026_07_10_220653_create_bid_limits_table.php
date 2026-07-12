<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('bid_limits')) {
            Schema::create('bid_limits', function (Blueprint $table) {
            $table->id();
            $table->string('category', 100)->unique();
            $table->integer('max_price')->default(0);
            $table->text('notes')->nullable();
            $table->string('updated_by', 100)->nullable();
            $table->timestamps(); // includes updated_at
        });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('bid_limits');
    }
};
