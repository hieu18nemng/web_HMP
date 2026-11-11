@echo off
title CHIA SE WEB CHO BE YEU QUA INTERNET (LOCALTUNNEL)
echo ========================================================
echo   DANG TAO DUONG LINK INTERNET CHO BE YEU TRUY CAP...
echo ========================================================
echo.

start /b "" node "%~dp0server.js"
timeout /t 2 >nul

echo Dang ket noi mang de lay link HTTPS...
cmd /c npx --yes localtunnel --port 8088
pause
