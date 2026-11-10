# ====================================================================
# Automated Database Backup Script (PowerShell for Windows)
# ====================================================================
$ErrorActionPreference = "Stop"

$repoRoot = (Get-Item $PSScriptRoot).Parent.FullName
$backupDir = Join-Path $repoRoot "backups"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$sqlFile = Join-Path $backupDir "ecommerce_backup_$timestamp.sql"
$containerName = "ecommerce-db"
$dbUser = if ($env:DB_USER) { $env:DB_USER } else { "postgres" }
$dbName = if ($env:DB_NAME) { $env:DB_NAME } else { "ecommerce_db" }

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Starting PostgreSQL Database Backup" -ForegroundColor Cyan
Write-Host "Target Container: $containerName"
Write-Host "Target Database:  $dbName"
Write-Host "Destination:      $sqlFile"
Write-Host "=========================================="

# Check if container is running
$running = docker ps --filter "name=$containerName" --format "{{.Names}}"
if ($running -notcontains $containerName) {
    Write-Host "ERROR: Container '$containerName' is not running!" -ForegroundColor Red
    exit 1
}

# Run pg_dump
docker exec -t $containerName pg_dump -U $dbUser --clean --if-exists $dbName > $sqlFile

# Calculate hash and size
$fileInfo = Get-Item $sqlFile
$hash = (Get-FileHash -Path $sqlFile -Algorithm SHA256).Hash

Write-Host "Backup completed successfully!" -ForegroundColor Green
Write-Host "File size: $([math]::Round($fileInfo.Length / 1KB, 2)) KB"
Write-Host "SHA256:    $hash"
$hash | Out-File -FilePath "$sqlFile.sha256" -Encoding ASCII
Write-Host "==========================================" -ForegroundColor Cyan
