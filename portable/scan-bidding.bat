@echo off
chcp 65001 >nul 2>nul
title Biddlog Collector - Scan Bidding

echo.
echo ========================================================
echo   BIDDLOG COLLECTOR - SCAN BIDDING
echo ========================================================
echo.

set "BASE=%~dp0"
set "PYTHON=%BASE%python\python.exe"
set "ADB=%BASE%platform-tools\adb.exe"
set "COLLECTOR=%BASE%..\collector"
set "PATH=%BASE%platform-tools;%PATH%"

REM -------- Cek setup --------
if not exist "%PYTHON%" (
    echo [ERROR] Python belum di-setup. Jalankan setup.bat terlebih dahulu.
    pause
    exit /b 1
)
if not exist "%ADB%" (
    echo [ERROR] ADB belum di-setup. Jalankan setup.bat terlebih dahulu.
    pause
    exit /b 1
)

REM -------- Cek HP terhubung --------
echo [*] Mengecek koneksi HP...
"%ADB%" start-server >nul 2>&1
timeout /t 1 >nul

for /f %%i in ('"%ADB%" devices ^| findstr /r "device$" ^| find /c /v ""') do set DEVICE_COUNT=%%i
if "%DEVICE_COUNT%"=="0" (
    echo.
    echo [ERROR] Tidak ada HP Android yang terhubung!
    echo.
    echo Pastikan:
    echo   1. HP tersambung via kabel USB data
    echo   2. USB Debugging aktif di Developer Options
    echo   3. Tekan "Allow" di prompt USB debugging di HP
    echo.
    pause
    exit /b 1
)
echo [OK] HP terdeteksi dan siap.

REM -------- Tanya expected total --------
echo.
set /p EXPECTED_TOTAL="Masukkan total barang hari ini (kosongkan jika tidak tahu): "
echo.

REM -------- Jalankan scan --------
echo [*] Memulai scan bidding...
echo     (Jangan sentuh HP selama proses berjalan)
echo.

if "%EXPECTED_TOTAL%"=="" (
    "%PYTHON%" "%COLLECTOR%\appium_collector.py" --backend adb --phone-feedback
) else (
    "%PYTHON%" "%COLLECTOR%\appium_collector.py" --backend adb --phone-feedback --expected-total %EXPECTED_TOTAL%
)

if errorlevel 1 (
    echo.
    echo [ERROR] Scan gagal. Lihat error di atas.
    pause
    exit /b 1
)

echo.
echo ========================================================
echo   SCAN SELESAI!
echo ========================================================
echo.
echo Hasil tersimpan di:
echo   %COLLECTOR%\output\scan-list\bidding-items.json
echo   %COLLECTOR%\output\scan-list\bidding-items.csv
echo.

REM -------- Tanya upload --------
set /p UPLOAD_CHOICE="Upload hasil ke server biddlog.site? (y/n): "
if /i not "%UPLOAD_CHOICE%"=="y" goto end

echo.
echo [*] Mengupload bidding-items.json ke server...
curl.exe -s -X POST "https://biddlog.site/api/data/upload" -F "key=biddlog2026" -F "path=scan-list/bidding-items.json" -F "file=@%COLLECTOR%\output\scan-list\bidding-items.json"
echo.
echo [*] Mengupload bidding-items.csv ke server...
curl.exe -s -X POST "https://biddlog.site/api/data/upload" -F "key=biddlog2026" -F "path=scan-list/bidding-items.csv" -F "file=@%COLLECTOR%\output\scan-list\bidding-items.csv"
echo.
echo [*] Mengupload scan-summary.json ke server...
curl.exe -s -X POST "https://biddlog.site/api/data/upload" -F "key=biddlog2026" -F "path=scan-list/scan-summary.json" -F "file=@%COLLECTOR%\output\scan-list\scan-summary.json"
echo.
echo [OK] Upload selesai! Buka https://biddlog.site dan klik "Load dari Server".

:end
echo.
pause
