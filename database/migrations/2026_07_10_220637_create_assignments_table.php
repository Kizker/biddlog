<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('assignments')) {
            Schema::create('assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('item_id')->constrained('items')->cascadeOnDelete();
            $table->string('assigned_to', 100)->index();
            $table->string('assigned_by', 100)->nullable();
            $table->timestamp('assigned_at')->useCurrent()->index();
            $table->text('notes')->nullable();
            
            // Note: In Laravel we typically use 'created_at' and 'updated_at'
            $table->timestamps();
        });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('assignments');
    }
};
