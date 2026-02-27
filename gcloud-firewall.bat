@echo off
chcp 65001 >nul 2>&1
echo.
echo  ================================================
echo   ACCESO DIGITAL - Firewall GCP
echo  ================================================
echo.
echo  Instancia : instance-20260204-224958
echo  Zona      : us-central1-c
echo.

:: 1. Agregar tag a la instancia
echo  [1/3] Agregando tag "iados-dev" a la instancia...
gcloud compute instances add-tags instance-20260204-224958 ^
  --tags=iados-dev ^
  --zone=us-central1-c

:: 2. Eliminar regla anterior si existe (evita conflicto)
echo.
echo  [2/3] Limpiando regla anterior si existe...
gcloud compute firewall-rules delete iados-dev --quiet 2>nul

:: 3. Crear regla apuntando al tag
echo.
echo  [3/3] Creando regla de firewall para puertos 3001, 3002, 4000...
gcloud compute firewall-rules create iados-dev ^
  --direction=INGRESS ^
  --action=ALLOW ^
  --rules=tcp:3001,tcp:3002,tcp:4000 ^
  --source-ranges=0.0.0.0/0 ^
  --target-tags=iados-dev ^
  --description="Acceso Digital - Backend 3001, Frontend 3002, App Movil 4000"

echo.
echo  ================================================
echo   Listo. Verifica con:
echo   gcloud compute firewall-rules describe iados-dev
echo.
echo   Prueba acceso:
echo   curl http://34.71.132.26:3001/api/health
echo   curl http://34.71.132.26:3002
echo  ================================================
echo.
pause
