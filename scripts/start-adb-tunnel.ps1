# ============================================================
# ADB SSH Tunnel — Laptop Windows → VPS
# ============================================================
#
# Script ini menjalankan SSH reverse tunnel yang meneruskan
# port ADB (5037) dari laptop ke VPS, sehingga collector
# di VPS bisa mengontrol HP Android yang terhubung ke laptop.
#
# PENGGUNAAN:
#   1. Pastikan HP Android terhubung via USB dan USB Debugging aktif
#   2. Pastikan ADB server sudah berjalan: adb start-server
#   3. Jalankan script ini: .\start-adb-tunnel.ps1
#
# PRASYARAT:
#   - SSH key sudah di-setup (ssh-keygen lalu copy ke VPS)
#   - ADB sudah ada di PATH
#   - HP sudah authorized (adb devices menunjukkan "device")
# ============================================================

param(
    [string]$VpsHost = "72.62.127.119",
    [string]$VpsUser = "root",
    [int]$AdbPort = 5037,
    [int]$RetryDelay = 5
)

$ErrorActionPreference = "Stop"

function Write-Status($msg) {
    $ts = Get-Date -Format "HH:mm:ss"
    Write-Host "[$ts] $msg" -ForegroundColor Cyan
}

function Write-OK($msg) {
    $ts = Get-Date -Format "HH:mm:ss"
    Write-Host "[$ts] OK: $msg" -ForegroundColor Green
}

function Write-Err($msg) {
    $ts = Get-Date -Format "HH:mm:ss"
    Write-Host "[$ts] ERROR: $msg" -ForegroundColor Red
}

# --- Step 1: Cek ADB ---
Write-Status "Mengecek ADB..."
$adbPath = Get-Command adb -ErrorAction SilentlyContinue
if (-not $adbPath) {
    Write-Err "ADB tidak ditemukan di PATH. Install Android Platform Tools."
    exit 1
}

# Start ADB server jika belum jalan
& adb start-server 2>$null
Start-Sleep -Seconds 1

# Cek device
$devices = & adb devices 2>&1
$authorized = ($devices | Select-String "device$" | Measure-Object).Count
if ($authorized -eq 0) {
    Write-Err "Tidak ada HP Android yang terdeteksi. Sambungkan HP dan aktifkan USB Debugging."
    Write-Host ""
    Write-Host "Output adb devices:" -ForegroundColor Yellow
    Write-Host $devices
    exit 1
}
Write-OK "$authorized device terdeteksi dan authorized."

# --- Step 2: Buat SSH Tunnel ---
Write-Host ""
Write-Status "Memulai SSH reverse tunnel..."
Write-Status "Laptop ADB port $AdbPort -> VPS $VpsUser@$VpsHost port $AdbPort"
Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  TUNNEL AKTIF — Jangan tutup window ini" -ForegroundColor Yellow
Write-Host "  Tekan Ctrl+C untuk menghentikan tunnel" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

# Loop dengan auto-reconnect
while ($true) {
    try {
        Write-Status "Menghubungkan SSH tunnel..."

        # SSH reverse tunnel: VPS localhost:5037 -> Laptop localhost:5037
        # -N = no remote command
        # -R = reverse tunnel
        # -o ServerAliveInterval = keep alive setiap 30 detik
        # -o ServerAliveCountMax = putus setelah 3x gagal keep alive
        # -o ExitOnForwardFailure = keluar jika port forwarding gagal
        & ssh `
            -N `
            -R "${AdbPort}:localhost:${AdbPort}" `
            -o "ServerAliveInterval=30" `
            -o "ServerAliveCountMax=3" `
            -o "ExitOnForwardFailure=yes" `
            -o "StrictHostKeyChecking=accept-new" `
            "${VpsUser}@${VpsHost}"

        Write-Err "SSH tunnel terputus."
    }
    catch {
        Write-Err "SSH tunnel error: $_"
    }

    Write-Status "Reconnect dalam $RetryDelay detik..."
    Start-Sleep -Seconds $RetryDelay
}
