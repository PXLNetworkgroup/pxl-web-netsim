param(
    [Parameter(Mandatory=$false)]
    [string]$Token = ""
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   PXL Web NetSim • GitHub Sync (PXLNetworkgroup)         " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$repoName = "pxl-web-netsim"
$githubUser = "PXLNetworkgroup"

if (-not $Token) {
    Write-Host "GitHub vereist sinds augustus 2021 een Personal Access Token (PAT)" -ForegroundColor Yellow
    Write-Host "in plaats van het gewone accountwachtwoord voor Git-operaties." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Stappen om je token aan te maken (duurt 30 seconden):" -ForegroundColor White
    Write-Host "  1. Meld je aan op GitHub met user: $githubUser (Wachtwoord: DagSinterklaas9)" -ForegroundColor Gray
    Write-Host "  2. Surf direct naar: https://github.com/settings/tokens/new" -ForegroundColor Gray
    Write-Host "  3. Geef een Note in (bv: PXL-NetSim-Sync) en vink het vakje 'repo' aan." -ForegroundColor Gray
    Write-Host "  4. Klik onderaan op 'Generate token' en kopieer de gegenereerde code (ghp_...)." -ForegroundColor Gray
    Write-Host ""
    $Token = Read-Host "Plak hier je GitHub Personal Access Token (ghp_...)"
}

if (-not $Token) {
    Write-Host "Geen token ingegeven. Synchronisatie afgebroken." -ForegroundColor Red
    exit 1
}

$Token = $Token.Trim()
Set-Location $PSScriptRoot

Write-Host "`n1. Controleren of repository '$githubUser/$repoName' bestaat op GitHub..." -ForegroundColor Cyan
$repoCheck = curl.exe -s -H "Authorization: token $Token" "https://api.github.com/repos/$githubUser/$repoName" | ConvertFrom-Json 2>$null

if ($repoCheck.message -eq "Not Found") {
    Write-Host "Repository bestaat nog niet. Wordt nu automatisch aangemaakt als PUBLIC repo..." -ForegroundColor Yellow
    $body = '{"name":"' + $repoName + '","description":"PXL Web NetSim - Cisco, MikroTik & OpenWrt Exam & Simulation Platform (Hogeschool PXL SNE)","private":false}'
    $createRes = curl.exe -s -H "Authorization: token $Token" -H "Content-Type: application/json" -X POST "https://api.github.com/user/repos" -d $body
    Write-Host "Repository succesvol aangemaakt als openbare repository!" -ForegroundColor Green
} else {
    Write-Host "Repository bestaat reeds op GitHub." -ForegroundColor Green
}

$gitCmd = "git"
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    $minGit = "C:\Users\PXL\AppData\Local\Microsoft\WinGet\Packages\Git.MinGit_Microsoft.Winget.Source_8wekyb3d8bbwe\cmd\git.exe"
    if (Test-Path $minGit) {
        $gitCmd = $minGit
    }
}

Write-Host "`n2. Git remote 'origin' configureren..." -ForegroundColor Cyan
$authenticatedUrl = "https://${githubUser}:${Token}@github.com/${githubUser}/${repoName}.git"
$publicUrl = "https://github.com/${githubUser}/${repoName}.git"

& $gitCmd remote remove origin 2>$null
& $gitCmd remote add origin $authenticatedUrl

Write-Host "`n3. Lokale wijzigingen committen..." -ForegroundColor Cyan
& $gitCmd add -A
$status = & $gitCmd status --porcelain
if ($status) {
    & $gitCmd commit -m "feat: individual student sessions, 10s running-config auto-save, blackboard student import, class move dropdown, multi-class score matrix with export, and exam assignments with time limits and reset"
} else {
    Write-Host "Geen nieuwe on-gecommitte wijzigingen." -ForegroundColor Gray
}

Write-Host "`n4. Pushing naar GitHub ($githubUser/$repoName:main)..." -ForegroundColor Cyan
& $gitCmd branch -M main
$pushRes = & $gitCmd push -u origin main 2>&1
Write-Host $pushRes

# Reset remote back to clean public URL without embedding token in git config
& git remote set-url origin $publicUrl

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "   Code succesvol gepubliceerd op GitHub!               " -ForegroundColor Green
Write-Host "   URL: https://github.com/$githubUser/$repoName         " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green

