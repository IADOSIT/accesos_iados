#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
#  iaDoS — Deploy script (se ejecuta EN el VPS via SSH)
#  Llamado automáticamente desde entorno.bat opciones 19 / 21
# ═══════════════════════════════════════════════════════════════════
set -e
VPS_DIR="/opt/iados"

echo ""
echo "── iaDoS Deploy ────────────────────────────────────────"

# ── 1. Git pull ───────────────────────────────────────────────────
echo "[1/2] Actualizando código desde GitHub..."
cd "$VPS_DIR"
git pull --quiet
VERSION=$(cat VERSION 2>/dev/null || echo "?")
echo "  Versión: $VERSION"

# ── 2. Docker compose up --build ─────────────────────────────────
echo "[2/2] Reconstruyendo y reiniciando contenedores..."
docker compose up -d --build

echo ""
echo "── Deploy completado ──────────────────────────────────"
docker compose ps
echo ""
