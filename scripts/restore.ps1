# ====================================================================
# Automated Database Restore Script (PowerShell for Windows)
# ====================================================================
param (
    [string]$BackupFile = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = (Get-Item $PSScriptRoot).Parent.FullName
$backupDir = Join-Path $repoRoot "backups"
$containerName = "ecommerce-db"
$dbUser = if ($env:DB_USER) { $env:DB_USER } else { "postgres" }
$dbName = if ($env:DB_NAME) { $env:DB_NAME } else { "ecommerce_db" }

if (-not $BackupFile) {
    $latest = Get-ChildItem -Path $backupDir -Filter "*.sql" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $latest) {
        Write-Host "ERROR: No .sql backup files found in $backupDir" -ForegroundColor Red
        exit 1
    }
    $BackupFile = $latest.FullName
}

if (-not (Test-Path $BackupFile)) {
    Write-Host "ERROR: Specified backup file does not exist: $BackupFile" -ForegroundColor Red
    exit 1
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Starting PostgreSQL Database Restoration" -ForegroundColor Cyan
Write-Host "Backup File:      $BackupFile"
Write-Host "Target Container: $containerName"
Write-Host "Target Database:  $dbName"
Write-Host "=========================================="

# Check if container is running
$running = docker ps --filter "name=$containerName" --format "{{.Names}}"
if ($running -notcontains $containerName) {
    Write-Host "ERROR: Container '$containerName' is not running!" -ForegroundColor Red
    exit 1
}

# Pipe backup into psql
Get-Content -Path $BackupFile | docker exec -i $containerName psql -U $dbUser -d $dbName

Write-Host "Database restored successfully!" -ForegroundColor Green
Write-Host "Verifying restored entity counts:" -ForegroundColor Cyan
docker exec -t $containerName psql -U $dbUser -d $dbName -c "SELECT 'products' as table, count(*) FROM products UNION ALL SELECT 'orders', count(*) FROM orders;"
Write-Host "==========================================" -ForegroundColor Cyan
