#!/usr/bin/env bash
# ============================================================
# ADB SSH Tunnel — Laptop Linux/Mac → VPS
# ============================================================
#
# Script ini menjalankan SSH reverse tunnel yang meneruskan
# port ADB (5037) dari laptop ke VPS, sehingga collector
# di VPS bisa mengontrol HP Android yang terhubung ke laptop.
#
# PENGGUNAAN:
#   chmod +x start-adb-tunnel.sh
#   ./start-adb-tunnel.sh
#
# PRASYARAT:
#   - SSH key sudah di-setup
#   - ADB sudah terinstall
#   - HP sudah authorized
# ============================================================

set -euo pipefail

VPS_HOST="${VPS_HOST:-72.62.127.119}"
VPS_USER="${VPS_USER:-root}"
ADB_PORT="${ADB_PORT:-5037}"
RETRY_DELAY="${RETRY_DELAY:-5}"

log() { echo "[$(date +%H:%M:%S)] $*"; }

# --- Cek ADB ---
if ! command -v adb &>/dev/null; then
    log "ERROR: ADB tidak ditemukan. Install Android Platform Tools."
    exit 1
fi

adb start-server 2>/dev/null || true
sleep 1

AUTHORIZED=$(adb devices 2>/dev/null | grep -c "device$" || true)
if [ "$AUTHORIZED" -eq 0 ]; then
    log "ERROR: Tidak ada HP Android terdeteksi."
    adb devices
    exit 1
fi
log "OK: $AUTHORIZED device terdeteksi."

# --- SSH Tunnel dengan auto-reconnect ---
log "Memulai SSH reverse tunnel..."
log "Laptop ADB :$ADB_PORT -> VPS $VPS_USER@$VPS_HOST :$ADB_PORT"
echo ""
echo "========================================"
echo "  TUNNEL AKTIF — Jangan tutup terminal"
echo "  Tekan Ctrl+C untuk menghentikan"
echo "========================================"
echo ""

while true; do
    log "Menghubungkan SSH tunnel..."
    ssh \
        -N \
        -R "${ADB_PORT}:localhost:${ADB_PORT}" \
        -o "ServerAliveInterval=30" \
        -o "ServerAliveCountMax=3" \
        -o "ExitOnForwardFailure=yes" \
        -o "StrictHostKeyChecking=accept-new" \
        "${VPS_USER}@${VPS_HOST}" || true

    log "SSH tunnel terputus. Reconnect dalam ${RETRY_DELAY}s..."
    sleep "$RETRY_DELAY"
done
