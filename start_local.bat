@echo off
title PXL Web NetSim Local Server
echo ============================================================
echo   PXL Web NetSim - Lokale Testomgeving
echo   Hogeschool PXL (Toegepaste Informatica / SNE)
echo ============================================================
echo.
cd /d "%~dp0"

set "PY_EXE=C:\Users\PXL\AppData\Local\Programs\Python\Python312\python.exe"
if not exist "%PY_EXE%" (
    set "PY_EXE=python"
)

echo Starten van lokale Flask server op poort 8080...
echo Open je browser op: http://localhost:8080
echo Druk op CTRL+C om te stoppen.
echo.
"%PY_EXE%" server.py
pause
