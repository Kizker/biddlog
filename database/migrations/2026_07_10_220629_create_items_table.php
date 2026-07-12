<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('items')) {
            Schema::create('items', function (Blueprint $table) {
            $table->id();
            $table->string('item_code', 100);
            $table->string('item_name', 500)->nullable();
            $table->string('category', 100)->default('Umum');
            $table->date('scan_date')->index();
            $table->integer('bid_price')->default(0);
            $table->enum('status', ['pending', 'assigned', 'bidded', 'won', 'lost'])->default('pending')->index();
            $table->string('assigned_to', 100)->nullable()->index();
            $table->timestamp('synced_at')->nullable()->useCurrentOnUpdate();
            $table->json('raw_data')->nullable();
            
            // Note: In Laravel we typically use 'created_at' and 'updated_at'
            $table->timestamps();
            
            $table->unique(['item_code', 'scan_date'], 'unique_item_per_date');
        });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('items');
    }
};
