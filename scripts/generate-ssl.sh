#!/usr/bin/env bash
# ====================================================================
# Generates self-signed TLS certificates for development/local testing
# ====================================================================
set -euo pipefail

SSL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/docker/nginx/ssl"
mkdir -p "$SSL_DIR"

if command -v node >/dev/null 2>&1; then
    node "$(dirname "${BASH_SOURCE[0]}")/generate-ssl.js"
elif command -v openssl >/dev/null 2>&1; then
    echo "Generating certificates using openssl..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$SSL_DIR/key.pem" \
        -out "$SSL_DIR/cert.pem" \
        -subj "/C=US/ST=California/L=SanFrancisco/O=AlgionsAILabs/OU=DevOps/CN=localhost"
    echo "Certificates created at $SSL_DIR"
else
    echo "Error: Neither node nor openssl found to generate certificates."
    exit 1
fi
