#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
#  iaDoS — Setup inicial del VPS  (Ubuntu 22.04 / 24.04)
#  Ejecutar como root:  bash setup-vps.sh
# ═══════════════════════════════════════════════════════════════════
set -e

VPS_DIR="/opt/iados"
echo ""
echo "═══════════════════════════════════════════════════"
echo "  iaDoS — Setup VPS"
echo "═══════════════════════════════════════════════════"
echo ""

# ── 1. Actualizar sistema ─────────────────────────────────────────
echo "[1/7] Actualizando sistema..."
apt-get update -qq && apt-get upgrade -y -qq

# ── 2. Node.js 20 LTS ────────────────────────────────────────────
echo "[2/7] Instalando Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
apt-get install -y nodejs >/dev/null 2>&1
echo "  Node: $(node -v)  NPM: $(npm -v)"

# ── 3. PM2 (gestor de procesos) ───────────────────────────────────
echo "[3/7] Instalando PM2..."
npm install -g pm2 >/dev/null 2>&1
pm2 startup systemd -u root --hp /root | tail -1 | bash >/dev/null 2>&1
echo "  PM2: $(pm2 -v)"

# ── 4. serve (para servir Flutter web estático) ───────────────────
echo "[4/7] Instalando serve..."
npm install -g serve >/dev/null 2>&1

# ── 5. Mosquitto MQTT ─────────────────────────────────────────────
echo "[5/7] Instalando Mosquitto..."
apt-get install -y mosquitto mosquitto-clients >/dev/null 2>&1

# Configuración básica (sin autenticación — el usuario la configura después)
cat > /etc/mosquitto/conf.d/iados.conf <<'EOF'
listener 1883
allow_anonymous true
EOF

systemctl enable mosquitto >/dev/null 2>&1
systemctl restart mosquitto
echo "  Mosquitto activo en puerto 1883"

# ── 6. Directorios del proyecto ───────────────────────────────────
echo "[6/7] Creando directorios..."
mkdir -p "$VPS_DIR/backend"
mkdir -p "$VPS_DIR/frontend"
mkdir -p "$VPS_DIR/flutter-web"
mkdir -p "$VPS_DIR/logs"

# ── 7. Firewall (ufw) ─────────────────────────────────────────────
echo "[7/7] Configurando firewall..."
if command -v ufw &>/dev/null; then
  ufw allow 22   comment "SSH"   >/dev/null 2>&1
  ufw allow 3001 comment "iaDoS Backend"   >/dev/null 2>&1
  ufw allow 3002 comment "iaDoS Frontend"  >/dev/null 2>&1
  ufw allow 4000 comment "iaDoS Flutter"   >/dev/null 2>&1
  ufw allow 1883 comment "MQTT"  >/dev/null 2>&1
  ufw --force enable >/dev/null 2>&1
  echo "  UFW activo — puertos 22, 3001, 3002, 4000, 1883 abiertos"
else
  echo "  ufw no disponible — configura el firewall de tu proveedor manualmente"
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Setup completado."
echo ""
echo "  PRÓXIMOS PASOS:"
echo "  1. Desde tu máquina Windows, usa el entorno.bat"
echo "     opción 19 para desplegar el código."
echo ""
echo "  2. Crea el archivo de variables de entorno:"
echo "     nano $VPS_DIR/backend/.env"
echo "     (Copia el contenido de backend/.env y ajusta"
echo "      MQTT_BROKER_URL=mqtt://localhost:1883"
echo "      PORTAL_URL=http://TU_IP_VPS:3002"
echo "      FRONTEND_URL=http://TU_IP_VPS:3002)"
echo ""
echo "  3. Desde tu máquina Windows, usa el entorno.bat"
echo "     opción 20 para build + deploy del Flutter web."
echo ""
echo "  4. Inicia los servicios:"
echo "     pm2 start $VPS_DIR/ecosystem.config.js"
echo "     pm2 save"
echo "═══════════════════════════════════════════════════"
