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
echo "[1/4] Actualizando código desde GitHub..."
cd "$VPS_DIR"
git pull --quiet
VERSION=$(cat VERSION 2>/dev/null || echo "?")
echo "  Versión: $VERSION"

# ── 1b. Sincronizar PORTAL_URL desde vps/backend.env.production ──────
PORTAL_URL_PROD=$(grep '^PORTAL_URL=' "$VPS_DIR/vps/backend.env.production" | sed 's/^PORTAL_URL=//;s/"//g')
if [ -n "$PORTAL_URL_PROD" ] && [ -f "$VPS_DIR/backend/.env" ]; then
  sed -i "s|^PORTAL_URL=.*|PORTAL_URL=$PORTAL_URL_PROD|" "$VPS_DIR/backend/.env"
  echo "  PORTAL_URL → $PORTAL_URL_PROD"
fi

# ── 2. Backend ────────────────────────────────────────────────────
echo "[2/4] Backend — npm install + prisma generate..."
cd "$VPS_DIR/backend"
npm install --omit=dev --quiet
npx prisma generate --quiet

# ── 3. Frontend ───────────────────────────────────────────────────
echo "[3/4] Frontend — npm install + next build..."
cd "$VPS_DIR/frontend"
npm install --quiet
npm run build

# ── 4. PM2 restart ───────────────────────────────────────────────
echo "[4/4] Reiniciando servicios..."
cd "$VPS_DIR"

if pm2 list | grep -q "iados-backend"; then
  pm2 restart iados-backend --update-env --silent
else
  pm2 start "$VPS_DIR/vps/ecosystem.config.js" --only iados-backend --silent
fi

if pm2 list | grep -q "iados-frontend"; then
  pm2 restart iados-frontend --update-env --silent
else
  pm2 start "$VPS_DIR/vps/ecosystem.config.js" --only iados-frontend --silent
fi

pm2 save --force >/dev/null 2>&1

echo ""
echo "── Deploy completado ──────────────────────────────────"
pm2 list --no-color | grep -E "iados-|name"
echo ""
