@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-weg-local.ps1"
if errorlevel 1 (
  echo.
  echo WEG HomeManager konnte nicht gestartet werden. Hinweise oben pruefen.
  pause
)
