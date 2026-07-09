@echo off
chcp 65001 >nul 2>nul
title Biddlog Collector - Setup

echo.
echo ========================================================
echo   BIDDLOG PORTABLE COLLECTOR - SETUP
echo   Setup pertama kali (sekali saja)
echo ========================================================
echo.

set "BASE=%~dp0"
set "PYTHON_DIR=%BASE%python"
set "ADB_DIR=%BASE%platform-tools"
set "COLLECTOR_DIR=%BASE%..\collector"

REM -------- Cek Python Embeddable --------
if exist "%PYTHON_DIR%\python.exe" (
    echo [OK] Python embeddable sudah ada.
    goto check_adb
)

echo [*] Mendownload Python embeddable...
if not exist "%PYTHON_DIR%" mkdir "%PYTHON_DIR%"
curl.exe -L -o "%TEMP%\python-embed.zip" "https://www.python.org/ftp/python/3.10.11/python-3.10.11-embed-amd64.zip"
if errorlevel 1 (
    echo [ERROR] Gagal download Python. Periksa koneksi internet.
    pause
    exit /b 1
)
echo [*] Mengekstrak Python...
tar -xf "%TEMP%\python-embed.zip" -C "%PYTHON_DIR%"
del "%TEMP%\python-embed.zip" 2>nul

REM Enable pip support: rewrite python310._pth
echo [*] Mengaktifkan pip support...
echo python310.zip> "%PYTHON_DIR%\python310._pth"
echo .>> "%PYTHON_DIR%\python310._pth"
echo ..\..\collector>> "%PYTHON_DIR%\python310._pth"
echo import site>> "%PYTHON_DIR%\python310._pth"

REM Download get-pip.py
echo [*] Mendownload pip...
curl.exe -L -o "%PYTHON_DIR%\get-pip.py" "https://bootstrap.pypa.io/get-pip.py"
"%PYTHON_DIR%\python.exe" "%PYTHON_DIR%\get-pip.py" --no-warn-script-location
del "%PYTHON_DIR%\get-pip.py" 2>nul

echo [OK] Python embeddable terinstall.

:check_adb
REM -------- Cek ADB --------
if exist "%ADB_DIR%\adb.exe" (
    echo [OK] ADB platform-tools sudah ada.
    goto check_collector
)

echo [*] Mendownload ADB platform-tools...
curl.exe -L -o "%TEMP%\platform-tools.zip" "https://dl.google.com/android/repository/platform-tools-latest-windows.zip"
if errorlevel 1 (
    echo [ERROR] Gagal download ADB. Periksa koneksi internet.
    pause
    exit /b 1
)
echo [*] Mengekstrak ADB...
tar -xf "%TEMP%\platform-tools.zip" -C "%BASE%."
del "%TEMP%\platform-tools.zip" 2>nul
echo [OK] ADB platform-tools terinstall.

:check_collector
REM -------- Cek collector scripts --------
if exist "%COLLECTOR_DIR%\appium_collector.py" (
    echo [OK] Collector scripts ditemukan.
) else (
    echo [ERROR] Collector scripts tidak ditemukan di %COLLECTOR_DIR%
    echo         Pastikan folder portable\ berada di dalam project biddlog.
    pause
    exit /b 1
)

REM -------- Verifikasi --------
echo.
echo ========================================================
echo   VERIFIKASI
echo ========================================================
echo.

"%PYTHON_DIR%\python.exe" --version
"%ADB_DIR%\adb.exe" version 2>nul | findstr /i "version"

echo.
echo [OK] Setup selesai! Sekarang kamu bisa menjalankan:
echo     - scan-bidding.bat    (scan daftar bidding)
echo     - scan-invoice.bat   (scan invoice per akun)
echo     - upload.bat          (upload hasil ke server)
echo.
pause
