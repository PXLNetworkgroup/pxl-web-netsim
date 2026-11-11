# deploy_gcloud.ps1 - Google Cloud Run One-Click Deployment for PXL Web NetSim
# © Parren, Van Waeyenberg, Frissaer, Jean, Hombroeks • Hogeschool PXL

$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot

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
$authAccount = (& $gcloudPath auth list --filter=status:ACTIVE --format="value(account)" 2>&1) | Out-String
$authAccount = $authAccount.Trim()

if (-not $authAccount) {
    Write-Host "Geen actieve Google Cloud account gevonden. Browser wordt geopend voor inloggen..." -ForegroundColor Yellow
    & $gcloudPath auth login
    $authAccount = (& $gcloudPath auth list --filter=status:ACTIVE --format="value(account)" 2>&1) | Out-String
    $authAccount = $authAccount.Trim()
}
Write-Host "Aangemeld als: $authAccount" -ForegroundColor Green

# 2. Check active Google Cloud Project
$currentProject = (& $gcloudPath config get-value project 2>&1) | Out-String
$currentProject = $currentProject.Trim()
if ($currentProject -like "*(unset)*" -or [string]::IsNullOrWhiteSpace($currentProject)) {
    $currentProject = ""
}

if (-not $currentProject) {
    $projectId = "precise-ether-507014-h7"
    & $gcloudPath config set project $projectId
    $currentProject = $projectId
}

Write-Host "Actief Google Cloud Project: $currentProject" -ForegroundColor Green

# 3. Enable required Google Cloud APIs (Cloud Run, Cloud Build, Artifact Registry)
Write-Host "[2/4] Cloud Run en Cloud Build APIs inschakelen..." -ForegroundColor Yellow
& $gcloudPath services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project $currentProject

# Ensure Default Compute Service Account has Cloud Build & Storage permissions
$projectNumber = (& $gcloudPath projects describe $currentProject --format="value(projectNumber)" 2>&1) | Out-String
$projectNumber = $projectNumber.Trim()
if ($projectNumber) {
    $sa = "$projectNumber-compute@developer.gserviceaccount.com"
    & $gcloudPath projects add-iam-policy-binding $currentProject --member="serviceAccount:$sa" --role="roles/storage.admin" --quiet 2>$null
    & $gcloudPath projects add-iam-policy-binding $currentProject --member="serviceAccount:$sa" --role="roles/artifactregistry.writer" --quiet 2>$null
}

# 4. Deploy to Cloud Run
Write-Host "[3/4] Applicatie bouwen en implementeren naar Cloud Run (europe-west1)..." -ForegroundColor Yellow
& $gcloudPath run deploy pxl-web-netsim `
    --source $PSScriptRoot `
    --platform managed `
    --region europe-west1 `
    --allow-unauthenticated `
    --memory 512Mi `
    --cpu 1 `
    --min-instances 0 `
    --max-instances 5 `
    --project $currentProject `
    --quiet

Write-Host "============================================================" -ForegroundColor Green
Write-Host "  Implementatie voltooid!" -ForegroundColor Green
Write-Host "  Uw collega's en studenten kunnen nu surfen naar de openbare URL." -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green

