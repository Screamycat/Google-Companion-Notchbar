@echo off
title Stopping L4-Windows-NotchBar
echo Stopping Notch, Vite, and Tauri processes...
taskkill /F /IM notch.exe /T 2>nul
taskkill /F /IM cargo.exe /T 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do taskkill /F /PID %%a 2>nul
echo Done! Notch dev server stopped.
timeout /t 2 >nul
