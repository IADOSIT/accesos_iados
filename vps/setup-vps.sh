#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
#  iaDoS — Setup inicial del VPS IONOS  (Ubuntu 22.04 / 24.04)
#  Ejecutar como root:  bash /tmp/setup-vps.sh
#
#  Este script:
#   1. Instala Node.js 20, PM2, Mosquitto, serve, git
#   2. Clona el repositorio de GitHub en /opt/iados
#   3. Instala dependencias y genera cliente Prisma
#   4. Configura PM2 para iniciar con el sistema
#   5. Configura el firewall (ufw)
# ═══════════════════════════════════════════════════════════════════
set -e

GITHUB_REPO="https://github.com/IADOSIT/accesos_iados.git"
VPS_DIR="/opt/iados"

echo ""
echo "══════════════════════════════════════════════════════"
echo "  iaDoS — Setup VPS IONOS"
echo "══════════════════════════════════════════════════════"
echo ""

# ── 1. Sistema ────────────────────────────────────────────────────
echo "[1/8] Actualizando sistema..."
apt-get update -qq
apt-get install -y -qq git curl

# ── 2. Node.js 20 LTS ────────────────────────────────────────────
echo "[2/8] Instalando Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
apt-get install -y -qq nodejs
echo "  Node $(node -v) | npm $(npm -v)"

# ── 3. PM2 + serve ───────────────────────────────────────────────
echo "[3/8] Instalando PM2 y serve..."
npm install -g pm2 serve >/dev/null 2>&1
echo "  PM2 $(pm2 -v)"

# ── 4. Mosquitto MQTT ─────────────────────────────────────────────
echo "[4/8] Instalando Mosquitto..."
apt-get install -y -qq mosquitto mosquitto-clients

cat > /etc/mosquitto/conf.d/iados.conf <<'EOF'
listener 1883
allow_anonymous true
EOF

systemctl enable mosquitto >/dev/null 2>&1
systemctl restart mosquitto
echo "  Mosquitto activo en :1883"

# ── 5. Clonar repositorio ─────────────────────────────────────────
echo "[5/8] Clonando repositorio de GitHub..."
if [ -d "$VPS_DIR/.git" ]; then
  echo "  Repositorio ya existe — actualizando con git pull..."
  cd "$VPS_DIR"
  git pull
else
  git clone "$GITHUB_REPO" "$VPS_DIR"
  echo "  Clonado en $VPS_DIR"
fi

mkdir -p "$VPS_DIR/logs"

# ── 6. Instalar dependencias ──────────────────────────────────────
echo "[6/8] Instalando dependencias..."

echo "  Backend..."
cd "$VPS_DIR/backend"
npm install --omit=dev --quiet
npx prisma generate --quiet

echo "  Frontend..."
cd "$VPS_DIR/frontend"
npm install --quiet

# ── 7. Firewall ───────────────────────────────────────────────────
echo "[7/8] Configurando firewall (ufw)..."
if command -v ufw &>/dev/null; then
  ufw allow 22   comment "SSH"              >/dev/null 2>&1
  ufw allow 3001 comment "iaDoS Backend"   >/dev/null 2>&1
  ufw allow 3002 comment "iaDoS Frontend"  >/dev/null 2>&1
  ufw allow 4000 comment "iaDoS Flutter"   >/dev/null 2>&1
  ufw allow 1883 comment "MQTT Mosquitto"  >/dev/null 2>&1
  ufw --force enable >/dev/null 2>&1
  echo "  UFW: puertos 22, 3001, 3002, 4000, 1883 abiertos"
else
  echo "  [SKIP] ufw no disponible"
fi

# ── 8. PM2 startup ───────────────────────────────────────────────
echo "[8/8] Configurando PM2 startup..."
pm2 startup systemd -u root --hp /root 2>/dev/null | grep "^sudo" | bash >/dev/null 2>&1 || true

echo ""
echo "══════════════════════════════════════════════════════"
echo "  Setup completado."
echo ""
echo "  SIGUIENTE PASO — Crear archivos .env:"
echo ""
echo "  nano $VPS_DIR/backend/.env"
echo "    (Pega el contenido de vps/backend.env.production"
echo "     con tus datos reales)"
echo ""
echo "  nano $VPS_DIR/frontend/.env.local"
echo "    (Pega el contenido de vps/frontend.env.production)"
echo ""
echo "  Luego ejecuta:"
echo "    bash $VPS_DIR/vps/deploy-server.sh"
echo "    pm2 save"
echo "══════════════════════════════════════════════════════"
