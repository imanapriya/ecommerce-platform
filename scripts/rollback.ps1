# ====================================================================
# Automated Application Rollback Procedure (PowerShell for Windows)
# ====================================================================
param (
    [Parameter(Mandatory=$true)]
    [string]$TargetTag
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Initiating Application Rollback" -ForegroundColor Cyan
Write-Host "Target Tag: ecommerce-api:$TargetTag"
Write-Host "Timestamp:  $((Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))"
Write-Host "=========================================="

# 1. Set environment variable
$env:IMAGE_TAG = $TargetTag

# 2. Re-deploy API service
Write-Host "Step 1: Re-deploying API service with target tag..." -ForegroundColor Yellow
docker compose up -d --no-deps --build=false api

# 3. Wait for readiness
Write-Host "Step 2: Probing health and readiness endpoints..." -ForegroundColor Yellow
$maxAttempts = 20
$attempt = 0
$healthy = $false

while ($attempt -lt $maxAttempts) {
    try {
        $res = Invoke-WebRequest -Uri "https://localhost/ready" -SkipCertificateCheck -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue
        if ($res.StatusCode -eq 200) {
            $healthy = $true
            break
        }
    } catch {
        # ignore during restart
    }
    Write-Host "Waiting for service readiness (attempt $($attempt + 1)/$maxAttempts)..."
    Start-Sleep -Seconds 3
    $attempt++
}

if ($healthy) {
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "Rollback successfully completed!" -ForegroundColor Green
    Write-Host "Service is healthy and accepting traffic on tag: $TargetTag" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
} else {
    Write-Host "CRITICAL: Service failed readiness check following rollback!" -ForegroundColor Red
    Write-Host "Check logs: docker compose logs api" -ForegroundColor Yellow
    exit 1
}
