@echo off
chcp 65001 >nul 2>nul
title Biddlog Collector - Scan Invoice

echo.
echo ========================================================
echo   BIDDLOG COLLECTOR - SCAN INVOICE
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

REM -------- Pilih akun --------
echo.
echo Pilih akun invoice:
echo   1. Menik  (aplikasi asli)
echo   2. Mubdi  (clone App Cloner)
echo   3. Aldi   (clone Island)
echo.
set /p AKUN_CHOICE="Pilih nomor (1/2/3): "

set "ACCOUNT="
if "%AKUN_CHOICE%"=="1" set "ACCOUNT=menik"
if "%AKUN_CHOICE%"=="2" set "ACCOUNT=mubdi"
if "%AKUN_CHOICE%"=="3" set "ACCOUNT=aldi"

if "%ACCOUNT%"=="" (
    echo [ERROR] Pilihan tidak valid.
    pause
    exit /b 1
)

echo.
echo [*] Akun dipilih: %ACCOUNT%

REM -------- Tanya expected total --------
set /p EXPECTED_TOTAL="Masukkan total barang akun %ACCOUNT% (kosongkan jika tidak tahu): "
echo.

REM -------- Pastikan HP di halaman yang benar --------
echo ========================================================
echo   PASTIKAN HP sudah di halaman invoice/riwayat barang
echo   akun %ACCOUNT% sebelum melanjutkan!
echo ========================================================
echo.
pause

REM -------- Jalankan scan --------
echo.
echo [*] Memulai scan invoice akun %ACCOUNT%...
echo     (Jangan sentuh HP selama proses berjalan)
echo.

if "%EXPECTED_TOTAL%"=="" (
    "%PYTHON%" "%COLLECTOR%\invoice_collector.py" --account %ACCOUNT% --no-launch --phone-feedback
) else (
    "%PYTHON%" "%COLLECTOR%\invoice_collector.py" --account %ACCOUNT% --no-launch --phone-feedback --expected-total %EXPECTED_TOTAL%
)

if errorlevel 1 (
    echo.
    echo [ERROR] Scan gagal. Lihat error di atas.
    pause
    exit /b 1
)

echo.
echo ========================================================
echo   SCAN INVOICE SELESAI!
echo ========================================================
echo.
echo Hasil tersimpan di:
echo   %COLLECTOR%\output\invoice\invoice-%ACCOUNT%.json
echo   %COLLECTOR%\output\invoice\invoice-%ACCOUNT%.csv
echo.

REM -------- Tanya upload --------
set /p UPLOAD_CHOICE="Upload hasil ke server biddlog.site? (y/n): "
if /i not "%UPLOAD_CHOICE%"=="y" goto end

echo.
echo [*] Mengupload invoice-%ACCOUNT%.json ke server...
curl.exe -s -X POST "https://biddlog.site/api/data/upload" -F "key=biddlog2026" -F "path=invoice/invoice-%ACCOUNT%.json" -F "file=@%COLLECTOR%\output\invoice\invoice-%ACCOUNT%.json"
echo.
echo [*] Mengupload invoice-%ACCOUNT%.csv ke server...
curl.exe -s -X POST "https://biddlog.site/api/data/upload" -F "key=biddlog2026" -F "path=invoice/invoice-%ACCOUNT%.csv" -F "file=@%COLLECTOR%\output\invoice\invoice-%ACCOUNT%.csv"
echo.

REM Cek apakah semua 3 akun sudah discan
if not exist "%COLLECTOR%\output\invoice\invoice-menik.json" goto upload_done
if not exist "%COLLECTOR%\output\invoice\invoice-mubdi.json" goto upload_done
if not exist "%COLLECTOR%\output\invoice\invoice-aldi.json" goto upload_done

echo [*] Semua 3 akun sudah terscan. Menggabungkan ke invoice-items.json...
"%PYTHON%" -c "import json;from pathlib import Path;d=Path(r'%COLLECTOR%\output\invoice');a=[];[a.extend(json.loads((d/('invoice-'+x+'.json')).read_text('utf-8'))) for x in ['menik','mubdi','aldi']];(d/'invoice-items.json').write_text(json.dumps(a,ensure_ascii=False,indent=2),'utf-8');print('[OK] invoice-items.json:',len(a),'item')"
echo [*] Mengupload invoice-items.json ke server...
curl.exe -s -X POST "https://biddlog.site/api/data/upload" -F "key=biddlog2026" -F "path=invoice/invoice-items.json" -F "file=@%COLLECTOR%\output\invoice\invoice-items.json"
echo.

:upload_done
echo [OK] Upload selesai! Buka https://biddlog.site dan klik "Load dari Server".

:end
echo.
pause
