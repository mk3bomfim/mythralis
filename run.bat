@echo off
title Mythralis Local Control Panel
:menu
cls
echo ==========================================================
echo               MYTHRALIS LOCAL ENVIRONMENT
echo ==========================================================
echo.
echo  [1] Start Local Server ^& Open Browser
echo  [2] Stop Local Server ^& Exit
echo.
echo ==========================================================
set /p choice="Select an option (1-2): "

if "%choice%"=="1" goto start_server
if "%choice%"=="2" goto stop_server
goto menu

:start_server
cls
echo Searching for local runtime environment...
echo.

where node >nul 2>nul
if %errorlevel% equ 0 (
    echo [INFO] Node.js found. Launching server on http://127.0.0.1:3000
    start "Mythralis_Server" /min node server.js
    timeout /t 2 >nul
    start http://127.0.0.1:3000
    echo.
    echo Server is running in the background.
    pause
    goto menu
)

where php >nul 2>nul
if %errorlevel% equ 0 (
    echo [INFO] PHP found. Launching server on http://127.0.0.1:8000
    start "Mythralis_Server" /min php -S 127.0.0.1:8000 -t gallery
    timeout /t 2 >nul
    start http://127.0.0.1:8000
    echo.
    echo Server is running in the background.
    pause
    goto menu
)

echo [ERROR] Could not find Node.js or PHP installed in your system PATH.
echo Please install one of them to run the project locally.
pause
goto menu

:stop_server
cls
echo Stopping Mythralis server processes...
taskkill /FI "WINDOWTITLE eq Mythralis_Server*" /T /F >nul 2>nul
taskkill /IM node.exe /F >nul 2>nul
taskkill /IM php.exe /F >nul 2>nul
echo.
echo Server stopped. Exiting...
timeout /t 2 >nul
exit
