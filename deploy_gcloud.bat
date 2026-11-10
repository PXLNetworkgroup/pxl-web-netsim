@echo off
echo ============================================================
echo   PXL Web NetSim - Google Cloud Run Deployment
echo   (c) Parren, Van Waeyenberg, Frissaer, Jean, Hombroeks
echo ============================================================
powershell.exe -ExecutionPolicy Bypass -File "%~dp0deploy_gcloud.ps1"
pause

