# ====================================================================
# Generates self-signed TLS certificates for development/local testing
# ====================================================================
$ErrorActionPreference = "Stop"

$sslDir = Join-Path $PSScriptRoot "..\docker\nginx\ssl"
if (-not (Test-Path $sslDir)) {
    New-Item -ItemType Directory -Path $sslDir -Force | Out-Null
}

$scriptJs = Join-Path $PSScriptRoot "generate-ssl.js"
if (Get-Command node -ErrorAction SilentlyContinue) {
    node $scriptJs
} else {
    Write-Host "Node.js not found in PATH." -ForegroundColor Red
    exit 1
}
