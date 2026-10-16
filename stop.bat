@echo off
title Stopping Google NotchBar
echo Gracefully stopping Google NotchBar...
taskkill /IM notch.exe 2>nul
timeout /t 1 >nul
taskkill /F /IM notch.exe /T 2>nul
taskkill /F /IM cargo.exe /T 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do taskkill /F /PID %%a 2>nul
echo Done! Google NotchBar stopped.
timeout /t 1 >nul
