#!/usr/bin/env bash
# ==============================================================================
# Biddlog.site - Automated Deployment & Update Script
# Target: ~/domains/biddlog.site/public_html
# ==============================================================================

set -e

echo "🚀 [1/4] Menarik pembaruan dari GitHub (main branch)..."
git fetch origin main
git reset --hard origin/main
git pull origin main

echo "📦 [2/4] Memeriksa dependensi PHP..."
if [ -f "composer.json" ] && command -v composer &> /dev/null; then
    composer install --no-dev --optimize-autoloader --quiet || true
fi

echo "🔒 [3/4] Mengatur hak akses folder storage & cache..."
chmod -R 775 storage bootstrap/cache database 2>/dev/null || true

echo "💾 [4/4] Memeriksa database..."
if [ ! -f "storage/installed.lock" ]; then
    echo "⚡ Menjalankan inisialisasi awal database..."
    php public/api/migrate_db.php || true
    touch storage/installed.lock
fi

echo "============================================================"
echo "✅ Pembaruan Biddlog.site Berhasil Diterapkan!"
echo "🌐 Akses Website: https://biddlog.site"
echo "============================================================"
