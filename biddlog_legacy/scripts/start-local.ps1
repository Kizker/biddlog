# start-local.ps1 — Menjalankan Vite dev server untuk dashboard biddlog
# Menggunakan Node.js dari Laragon (tidak perlu Node.js di system PATH)
#
# Cara pakai:
#   .\scripts\start-local.ps1
#
# Pastikan Laragon sudah "Start All" agar Nginx aktif di port 80
# Lalu buka http://biddlog.test di browser

$ErrorActionPreference = "Stop"

# Path Node.js dari Laragon
$NodeDir = "C:\laragon\bin\nodejs\node-v20"
$NodeExe = "$NodeDir\node.exe"
$NpmCmd  = "$NodeDir\npm.cmd"

# Verifikasi Node.js tersedia
if (-not (Test-Path $NodeExe)) {
    Write-Host "ERROR: Node.js tidak ditemukan di $NodeDir" -ForegroundColor Red
    Write-Host "Pastikan Laragon terinstal dan Node.js tersedia." -ForegroundColor Yellow
    exit 1
}

# Tambahkan Node.js ke PATH sesi ini (sementara, tidak permanen)
$env:PATH = "$NodeDir;$env:PATH"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Biddlog Dashboard — Local Dev Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Node.js : $(& $NodeExe --version)" -ForegroundColor Gray
Write-Host "  npm     : $(& $NpmCmd --version)" -ForegroundColor Gray
Write-Host ""
Write-Host "  URL     : http://biddlog.test" -ForegroundColor Green
Write-Host "  Vite    : http://localhost:5173" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Pastikan Laragon sudah 'Start All'" -ForegroundColor Yellow
Write-Host "  Tekan Ctrl+C untuk stop" -ForegroundColor DarkGray
Write-Host ""

# Pindah ke folder dashboard dan jalankan Vite dev server
Push-Location "$PSScriptRoot\..\dashboard"

try {
    # Install dependencies jika belum ada
    if (-not (Test-Path "node_modules")) {
        Write-Host "Installing dependencies..." -ForegroundColor Yellow
        & $NpmCmd install
        Write-Host ""
    }

    # Jalankan Vite dev server
    & $NpmCmd run dev
}
finally {
    Pop-Location
}
