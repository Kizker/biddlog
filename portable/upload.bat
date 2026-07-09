@echo off
chcp 65001 >nul 2>nul
title Biddlog Collector - Upload Manual

echo.
echo ========================================================
echo   BIDDLOG COLLECTOR - UPLOAD KE SERVER
echo ========================================================
echo.

set "BASE=%~dp0"
set "COLLECTOR=%BASE%..\collector"
set "SERVER=https://biddlog.site/api/data/upload"
set "KEY=biddlog2026"

echo Pilih file yang akan diupload:
echo.
echo   1. bidding-items.json  (hasil scan bidding)
echo   2. invoice-menik.json  (invoice akun Menik)
echo   3. invoice-mubdi.json  (invoice akun Mubdi)
echo   4. invoice-aldi.json   (invoice akun Aldi)
echo   5. Semua file yang ada
echo.
set /p CHOICE="Pilih nomor: "

if "%CHOICE%"=="1" goto upload_bidding
if "%CHOICE%"=="2" goto upload_invoice_menik
if "%CHOICE%"=="3" goto upload_invoice_mubdi
if "%CHOICE%"=="4" goto upload_invoice_aldi
if "%CHOICE%"=="5" goto upload_all
echo [ERROR] Pilihan tidak valid.
pause
exit /b 1

:upload_bidding
call :do_upload "scan-list/bidding-items.json" "%COLLECTOR%\output\scan-list\bidding-items.json"
call :do_upload "scan-list/bidding-items.csv" "%COLLECTOR%\output\scan-list\bidding-items.csv"
call :do_upload "scan-list/scan-summary.json" "%COLLECTOR%\output\scan-list\scan-summary.json"
goto done

:upload_invoice_menik
call :do_upload "invoice/invoice-menik.json" "%COLLECTOR%\output\invoice\invoice-menik.json"
call :do_upload "invoice/invoice-menik.csv" "%COLLECTOR%\output\invoice\invoice-menik.csv"
goto done

:upload_invoice_mubdi
call :do_upload "invoice/invoice-mubdi.json" "%COLLECTOR%\output\invoice\invoice-mubdi.json"
call :do_upload "invoice/invoice-mubdi.csv" "%COLLECTOR%\output\invoice\invoice-mubdi.csv"
goto done

:upload_invoice_aldi
call :do_upload "invoice/invoice-aldi.json" "%COLLECTOR%\output\invoice\invoice-aldi.json"
call :do_upload "invoice/invoice-aldi.csv" "%COLLECTOR%\output\invoice\invoice-aldi.csv"
goto done

:upload_all
echo.
echo [*] Mengupload semua file yang tersedia...
call :do_upload "scan-list/bidding-items.json" "%COLLECTOR%\output\scan-list\bidding-items.json"
call :do_upload "scan-list/bidding-items.csv" "%COLLECTOR%\output\scan-list\bidding-items.csv"
call :do_upload "scan-list/scan-summary.json" "%COLLECTOR%\output\scan-list\scan-summary.json"
call :do_upload "invoice/invoice-menik.json" "%COLLECTOR%\output\invoice\invoice-menik.json"
call :do_upload "invoice/invoice-menik.csv" "%COLLECTOR%\output\invoice\invoice-menik.csv"
call :do_upload "invoice/invoice-mubdi.json" "%COLLECTOR%\output\invoice\invoice-mubdi.json"
call :do_upload "invoice/invoice-mubdi.csv" "%COLLECTOR%\output\invoice\invoice-mubdi.csv"
call :do_upload "invoice/invoice-aldi.json" "%COLLECTOR%\output\invoice\invoice-aldi.json"
call :do_upload "invoice/invoice-aldi.csv" "%COLLECTOR%\output\invoice\invoice-aldi.csv"
call :do_upload "invoice/invoice-items.json" "%COLLECTOR%\output\invoice\invoice-items.json"
goto done

:do_upload
if not exist "%~2" (
    echo [SKIP] %~1 -- file tidak ada
    exit /b 0
)
echo [*] Mengupload %~1 ...
curl.exe -s -X POST "%SERVER%" -F "key=%KEY%" -F "path=%~1" -F "file=@%~2"
echo.
exit /b 0

:done
echo.
echo ========================================================
echo   UPLOAD SELESAI!
echo ========================================================
echo.
echo Buka https://biddlog.site dan klik "Load dari Server"
echo untuk melihat data terbaru.
echo.
pause
