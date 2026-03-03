#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
#  iaDoS — Script de deploy (se ejecuta EN el VPS via SSH)
#  Llamado automáticamente por entorno.bat opción 19
# ═══════════════════════════════════════════════════════════════════
set -e

VPS_DIR="/opt/iados"
echo ""
echo "[deploy] Instalando dependencias del backend..."
cd "$VPS_DIR/backend"
npm install --omit=dev --quiet
npx prisma generate --quiet

echo "[deploy] Build del frontend..."
cd "$VPS_DIR/frontend"
npm install --quiet
npm run build

echo "[deploy] Reiniciando servicios con PM2..."
if pm2 list | grep -q "iados-backend"; then
  pm2 restart iados-backend --update-env
else
  pm2 start "$VPS_DIR/ecosystem.config.js" --only iados-backend
fi

if pm2 list | grep -q "iados-frontend"; then
  pm2 restart iados-frontend --update-env
else
  pm2 start "$VPS_DIR/ecosystem.config.js" --only iados-frontend
fi

pm2 save --force >/dev/null 2>&1

echo ""
echo "[deploy] ✓ Backend y Frontend actualizados."
pm2 list --no-color
