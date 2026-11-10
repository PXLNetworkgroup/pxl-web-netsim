# deploy_gcloud.ps1 - Google Cloud Run One-Click Deployment for PXL Web NetSim
# © Parren, Van Waeyenberg, Frissaer, Jean, Hombroeks • Hogeschool PXL

$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  PXL Web NetSim • Google Cloud Run Deployment" -ForegroundColor Cyan
Write-Host "  Hogeschool PXL (Toegepaste Informatica / SNE)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Check gcloud installation
$gcloudPath = "C:\Users\PXL\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
if (-not (Test-Path $gcloudPath)) {
    $gcloudCmd = Get-Command gcloud -ErrorAction SilentlyContinue
    if ($gcloudCmd) {
        $gcloudPath = $gcloudCmd.Source
    } else {
        Write-Error "Google Cloud SDK (gcloud) niet gevonden. Installeer het via: winget install Google.CloudSDK"
        exit 1
    }
}

Write-Host "[1/4] Controleren van Google Cloud authenticatie..." -ForegroundColor Yellow
$authList = & $gcloudPath auth list --format="value(account)" 2>$null
if (-not $authList) {
    Write-Host "Geen actieve Google Cloud account gevonden. Browser wordt geopend voor inloggen..." -ForegroundColor Yellow
    & $gcloudPath auth login
} else {
    Write-Host "Aangemeld als: $authList" -ForegroundColor Green
}

# 2. Check active Google Cloud Project
$currentProject = & $gcloudPath config get-value project 2>$null
if (-not $currentProject -or $currentProject -eq "(unset)") {
    $projectId = Read-Host "Voer uw Google Cloud Project ID in (bijv. pxl-netsim-2026 of mijn-pxl-project)"
    & $gcloudPath config set project $projectId
} else {
    Write-Host "Actief Google Cloud Project: $currentProject" -ForegroundColor Green
}

# 3. Enable required Google Cloud APIs (Cloud Run & Cloud Build)
Write-Host "[2/4] Cloud Run en Cloud Build APIs inschakelen..." -ForegroundColor Yellow
& $gcloudPath services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

# 4. Deploy to Cloud Run
Write-Host "[3/4] Applicatie bouwen en implementeren naar Cloud Run (europe-west1)..." -ForegroundColor Yellow
& $gcloudPath run deploy pxl-web-netsim `
    --source . `
    --platform managed `
    --region europe-west1 `
    --allow-unauthenticated `
    --memory 512Mi `
    --cpu 1 `
    --min-instances 0 `
    --max-instances 5

Write-Host "============================================================" -ForegroundColor Green
Write-Host "  Implementatie voltooid!" -ForegroundColor Green
Write-Host "  Uw collega's en studenten kunnen nu surfen naar de openbare URL." -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
