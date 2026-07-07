@echo off
setlocal

set "ROOT=%~dp0"
set "NODE=C:\laragon\bin\nodejs\node-v20.19.3-win-x64\node.exe"
set "VITE=%ROOT%node_modules\vite\bin\vite.js"
set "URL=http://127.0.0.1:5173"

if not exist "%NODE%" (
  echo Node.exe tidak ditemukan: %NODE%
  exit /b 1
)

if not exist "%VITE%" (
  echo Vite tidak ditemukan: %VITE%
  exit /b 1
)

start "" /B "%NODE%" "%VITE%" --host 127.0.0.1 --port 5173
timeout /t 2 /nobreak >nul
start "" "%URL%"

