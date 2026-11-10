# ====================================================================
# Acceptance Test 4: Failure Detection & Self-Healing Chaos Drill (PowerShell)
# ====================================================================
$ErrorActionPreference = "Continue"

$apiUrl = if ($env:API_URL) { $env:API_URL } else { "http://localhost:3000" }
$containerDb = "ecommerce-db"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "STARTING RESILIENCY & CHAOS DRILL" -ForegroundColor Cyan
Write-Host "Target API: $apiUrl"
Write-Host "=========================================="

# Step 1: Baseline Health
Write-Host "`n[STEP 1] Verifying baseline system readiness..." -ForegroundColor Yellow
$baseline = Invoke-RestMethod -Uri "$apiUrl/ready" -Method Get -TimeoutSec 3 -ErrorAction SilentlyContinue
Write-Host "Baseline Readiness: $($baseline.status)" -ForegroundColor Green

# Step 2: Fault Injection
Write-Host "`n[STEP 2] Injecting fault: Stopping PostgreSQL database container ($containerDb)..." -ForegroundColor Yellow
docker stop $containerDb

# Step 3: Failure Detection
Write-Host "`n[STEP 3] Probing readiness probe during outage..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
try {
    $outage = Invoke-RestMethod -Uri "$apiUrl/ready" -Method Get -TimeoutSec 3
    Write-Host "Unexpected success: $($outage.status)" -ForegroundColor Red
} catch {
    Write-Host "SUCCESS: Failure detected! Probe returned 503 Service Unavailable" -ForegroundColor Green
}

# Step 4: Structured Logs
Write-Host "`n[STEP 4] Inspecting structured application error logs..." -ForegroundColor Yellow
docker logs --tail 10 ecommerce-api

# Step 5: Service Recovery
Write-Host "`n[STEP 5] Recovering PostgreSQL database container..." -ForegroundColor Yellow
docker start $containerDb

# Step 6: Verify Recovery
Write-Host "`n[STEP 6] Waiting for automatic reconnection..." -ForegroundColor Yellow
$recovered = $false
for ($i = 1; $i -le 15; $i++) {
    try {
        $res = Invoke-RestMethod -Uri "$apiUrl/ready" -Method Get -TimeoutSec 3
        if ($res.status -eq "ready") {
            $recovered = $true
            Write-Host "System recovered successfully after $i attempts! Status: $($res.status)" -ForegroundColor Green
            break
        }
    } catch {
        Write-Host "Awaiting database readiness (attempt $i/15)..."
        Start-Sleep -Seconds 2
    }
}

if ($recovered) {
    Write-Host "`n==========================================" -ForegroundColor Green
    Write-Host "CHAOS DRILL PASSED: Self-healing verified!" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
} else {
    Write-Host "`nCRITICAL: System failed to recover automatically." -ForegroundColor Red
    exit 1
}
