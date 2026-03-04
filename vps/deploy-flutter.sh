#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
#  iaDoS — Deploy Flutter web (se ejecuta EN el VPS via SSH)
#  Llamado desde entorno.bat opción 20 / 21
#  Los archivos build/web ya fueron subidos por scp desde Windows
# ═══════════════════════════════════════════════════════════════════
VPS_DIR="/opt/iados"

if pm2 list | grep -q "iados-flutter"; then
  pm2 restart iados-flutter --silent
else
  pm2 start "$VPS_DIR/vps/ecosystem.config.js" --only iados-flutter --silent
fi
pm2 save --force >/dev/null 2>&1
echo "iados-flutter actualizado."
pm2 describe iados-flutter --no-color | grep -E "status|uptime|restart"
