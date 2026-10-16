@echo off
title L4-Windows-NotchBar (Dev Server with Live Hot-Reload)
cd /d "%~dp0"
set PATH=%USERPROFILE%\.cargo\bin;%PATH%
echo ========================================================
echo   L4-Windows-NotchBar is running with LIVE HOT-RELOAD
echo ========================================================
echo   * Keep this window minimized in the background.
echo   * Any code changes we make will update INSTANTLY on
echo     your screen without restarting the app.
echo   * Close this window (or run stop.bat) when you want
echo     to quit the notch.
echo ========================================================
echo.
npm run tauri dev
