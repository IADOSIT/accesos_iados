@echo off
chcp 65001 >nul 2>&1
title Acceso Digital - iaDoS

:MENU
cls

:: Leer entorno de compilacion (GCP o DNS)
set "ENV_MODE=GCP"
if exist "%~dp0vps\env-mode.txt" for /f "usebackq tokens=1 delims= " %%M in ("%~dp0vps\env-mode.txt") do set "ENV_MODE=%%M"
if "%ENV_MODE%"=="DNS" set "APP_API_URL=https://accesodigitalapi.iados.mx/api"
if "%ENV_MODE%"=="DNS" set "APP_PORTAL_URL=https://accesodigital.iados.mx"
if "%ENV_MODE%"=="VPS" set "APP_API_URL=http://74.208.149.7:3001/api"
if "%ENV_MODE%"=="VPS" set "APP_PORTAL_URL=http://74.208.149.7:3002"
if not "%ENV_MODE%"=="DNS" if not "%ENV_MODE%"=="VPS" set "ENV_MODE=GCP"
if not "%ENV_MODE%"=="DNS" if not "%ENV_MODE%"=="VPS" set "APP_API_URL=http://34.71.132.26:3001/api"
if not "%ENV_MODE%"=="DNS" if not "%ENV_MODE%"=="VPS" set "APP_PORTAL_URL=http://34.71.132.26:3002"

echo.
echo  ================================================
echo   ACCESO DIGITAL - iaDoS  ::  ENTORNO  [%ENV_MODE%]
echo  ================================================
echo.
echo  [ SERVICIOS ]
echo   1. Levantar Backend      (puerto 3001)
echo   2. Levantar Frontend     (puerto 3002)
echo   3. Levantar App Movil    (puerto 4000 - Flutter web)
echo   4. Levantar TODO         (3 ventanas separadas)
echo.
echo  [ DIAGNOSTICO ]
echo   5. Test conexion BD         (PostgreSQL remoto)
echo   6. Test conexion MQTT       (broker IoT)
echo   7. Test puertos del sistema (3001, 3002, 4000, 1883, 5432)
echo   8. Estado procesos Node.js
echo   9. Matar puerto ocupado
echo  17. Mosquitto Broker         (estado / iniciar / reiniciar)
echo.
echo  [ MANTENIMIENTO ]
echo  10. Instalar dependencias    (npm install ambos)
echo  11. Prisma DB push           (sync schema a BD)
echo  12. Prisma generate          (regenerar cliente)
echo.
echo  [ ACCESO EXTERNO - GCP: 34.71.132.26 ]
echo  13. App Movil - IP externa   (Flutter web apunta a 34.71.132.26:3001)
echo  14. Abrir puertos - Firewall Windows (3001, 3002, 4000)
echo  15. Levantar TODO con IP externa (3 ventanas)
echo  16. Compilar APK Android         (modo: %ENV_MODE%)
echo.
echo  [ VPS - PRODUCCION  74.208.149.7 ]
echo  18. SSH al VPS
echo  19. Deploy Backend + Frontend   (git pull + docker compose up)
echo  20. Build Flutter web + Deploy  (build local + scp + pm2 restart)
echo  21. Deploy TODO                 (19 + 20 completo)
echo  22. Estado del VPS              (docker ps + ram + disco)
echo  23. Logs del VPS                (docker compose logs, 80 lineas)
echo  24. Compilar APK para VPS       (pide nombre, apunta a VPS)
echo  25. Nueva version               (bump VERSION + git tag + push)
echo  26. Cambiar entorno compilacion (actual: %ENV_MODE%)
echo.
echo   0. Salir
echo.
set "OPT="
set /p OPT="  Selecciona una opcion: "

if "%OPT%"=="1"  goto BACKEND
if "%OPT%"=="2"  goto FRONTEND
if "%OPT%"=="3"  goto MOVIL
if "%OPT%"=="4"  goto TODOS
if "%OPT%"=="5"  goto TEST_BD
if "%OPT%"=="6"  goto TEST_MQTT
if "%OPT%"=="7"  goto TEST_PUERTOS
if "%OPT%"=="8"  goto ESTADO_NODE
if "%OPT%"=="9"  goto MATAR_PUERTO
if "%OPT%"=="10" goto INSTALAR
if "%OPT%"=="11" goto PRISMA_PUSH
if "%OPT%"=="12" goto PRISMA_GEN
if "%OPT%"=="13" goto MOVIL_EXT
if "%OPT%"=="14" goto ABRIR_PUERTOS
if "%OPT%"=="15" goto TODOS_EXT
if "%OPT%"=="16" goto BUILD_APK
if "%OPT%"=="17" goto MOSQUITTO
if "%OPT%"=="18" goto VPS_SSH
if "%OPT%"=="19" goto VPS_DEPLOY_WEB
if "%OPT%"=="20" goto VPS_DEPLOY_FLUTTER
if "%OPT%"=="21" goto VPS_DEPLOY_ALL
if "%OPT%"=="22" goto VPS_STATUS
if "%OPT%"=="23" goto VPS_LOGS
if "%OPT%"=="24" goto BUILD_APK_VPS
if "%OPT%"=="25" goto VERSION_BUMP
if "%OPT%"=="26" goto SWITCH_ENV
if "%OPT%"=="0"  goto FIN

echo.
echo  Opcion invalida. Intenta de nuevo.
timeout /t 2 /nobreak >nul
goto MENU

::-----------------------------------------------------------------
:BACKEND
cls
echo.
echo  Iniciando Backend en puerto 3001...
echo  (Presiona CTRL+C para detener)
echo.
cd /d "%~dp0backend"
node src/index.js
cd /d "%~dp0"
echo.
pause
goto MENU

::-----------------------------------------------------------------
:FRONTEND
cls
echo.
echo  Iniciando Frontend en puerto 3002...
echo  (Presiona CTRL+C para detener)
echo.
cd /d "%~dp0frontend"
npm run dev
cd /d "%~dp0"
echo.
pause
goto MENU

::-----------------------------------------------------------------
:MOVIL
cls
echo.
echo  Iniciando App Movil Flutter en puerto 4000...
echo  Abre en tu navegador: http://localhost:4000
echo  (Presiona CTRL+C para detener)
echo.
cd /d "%~dp0mobile"
C:\flutter\bin\flutter.bat run -d web-server --web-port 4000 --web-hostname 0.0.0.0
cd /d "%~dp0"
echo.
pause
goto MENU

::-----------------------------------------------------------------
:TODOS
cls
echo.
echo  Iniciando servicios en ventanas separadas...
start "iaDoS Backend :3001" cmd /k "cd /d %~dp0backend && node src/index.js"
start "iaDoS Frontend :3002" cmd /k "cd /d %~dp0frontend && npm run dev"
start "iaDoS App Movil :4000" cmd /k "cd /d %~dp0mobile && C:\flutter\bin\flutter.bat run -d web-server --web-port 4000 --web-hostname 0.0.0.0"
echo.
echo   Backend   -^> http://localhost:3001/api/health
echo   Frontend  -^> http://localhost:3002
echo   App Movil -^> http://localhost:4000
echo.
goto MENU

::-----------------------------------------------------------------
:TEST_BD
cls
echo.
echo  Probando conexion a PostgreSQL...
echo   Host: 74.208.149.7   Puerto: 5432
echo.
powershell -NoProfile -Command ^
  "try { $c = New-Object System.Net.Sockets.TcpClient; $r = $c.BeginConnect('74.208.149.7',5432,$null,$null); $ok = $r.AsyncWaitHandle.WaitOne(5000); if($ok -and $c.Connected){ Write-Host '  [OK] Puerto 5432 alcanzable' -ForegroundColor Green }else{ Write-Host '  [FAIL] No se pudo alcanzar 5432' -ForegroundColor Red }; $c.Close() } catch { Write-Host ('  [ERROR] '+$_.Exception.Message) -ForegroundColor Red }"
echo.
echo  Probando con Prisma Client...
cd /d "%~dp0backend"
node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.$connect().then(()=>{console.log('  [OK] Prisma conectado a la BD');return p.$disconnect()}).catch(e=>console.error('  [FAIL] '+e.message));"
cd /d "%~dp0"
echo.
pause
goto MENU

::-----------------------------------------------------------------
:TEST_MQTT
cls
echo.
echo  Probando conexion MQTT...
echo.
echo  Broker local: localhost:1883
echo.
powershell -NoProfile -Command ^
  "try { $c = New-Object System.Net.Sockets.TcpClient; $r = $c.BeginConnect('localhost',1883,$null,$null); $ok = $r.AsyncWaitHandle.WaitOne(4000); if($ok -and $c.Connected){ Write-Host '  [OK] Broker MQTT respondiendo en localhost:1883' -ForegroundColor Green }else{ Write-Host '  [FAIL] Broker no responde - verificar servicio Mosquitto' -ForegroundColor Red }; $c.Close() } catch { Write-Host '  [ERROR] No se pudo conectar a localhost:1883' -ForegroundColor Red }"
echo.
echo  Estado del servicio Mosquitto:
powershell -NoProfile -Command ^
  "$s=Get-Service mosquitto -ErrorAction SilentlyContinue;if($s){if($s.Status -eq 'Running'){Write-Host ('  [CORRIENDO] '+$s.Status) -ForegroundColor Green}else{Write-Host ('  [DETENIDO] '+$s.Status) -ForegroundColor Red}}else{Write-Host '  [NO INSTALADO]' -ForegroundColor Red}"
echo.
pause
goto MENU

::-----------------------------------------------------------------
:TEST_PUERTOS
cls
echo.
echo  Verificando puertos...
echo.

echo  Puerto 3001 (Backend):
powershell -NoProfile -Command ^
  "$p=Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue;if($p){$pr=Get-Process -Id $p[0].OwningProcess -ErrorAction SilentlyContinue;Write-Host ('  [OCUPADO] PID '+$p[0].OwningProcess+' - '+$pr.Name) -ForegroundColor Yellow}else{Write-Host '  [LIBRE]' -ForegroundColor Green}"

echo.
echo  Puerto 3002 (Frontend):
powershell -NoProfile -Command ^
  "$p=Get-NetTCPConnection -LocalPort 3002 -ErrorAction SilentlyContinue;if($p){$pr=Get-Process -Id $p[0].OwningProcess -ErrorAction SilentlyContinue;Write-Host ('  [OCUPADO] PID '+$p[0].OwningProcess+' - '+$pr.Name) -ForegroundColor Yellow}else{Write-Host '  [LIBRE]' -ForegroundColor Green}"

echo.
echo  Puerto 4000 (App Movil Flutter):
powershell -NoProfile -Command ^
  "$p=Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue;if($p){$pr=Get-Process -Id $p[0].OwningProcess -ErrorAction SilentlyContinue;Write-Host ('  [OCUPADO] PID '+$p[0].OwningProcess+' - '+$pr.Name) -ForegroundColor Yellow}else{Write-Host '  [LIBRE]' -ForegroundColor Green}"

echo.
echo  Puerto 5432 (PostgreSQL remoto - test TCP):
powershell -NoProfile -Command ^
  "try{$c=New-Object System.Net.Sockets.TcpClient;$r=$c.BeginConnect('74.208.149.7',5432,$null,$null);if($r.AsyncWaitHandle.WaitOne(4000)-and $c.Connected){Write-Host '  [ALCANZABLE]' -ForegroundColor Green}else{Write-Host '  [NO ALCANZABLE]' -ForegroundColor Red};$c.Close()}catch{Write-Host '  [ERROR]' -ForegroundColor Red}"

echo.
echo  Puerto 1883 (MQTT local):
powershell -NoProfile -Command ^
  "$p=Get-NetTCPConnection -LocalPort 1883 -ErrorAction SilentlyContinue;if($p){Write-Host '  [ACTIVO] Broker MQTT local corriendo' -ForegroundColor Green}else{Write-Host '  [INACTIVO] Sin broker local (modo remoto o simulacion)' -ForegroundColor Cyan}"

echo.
pause
goto MENU

::-----------------------------------------------------------------
:ESTADO_NODE
cls
echo.
echo  Procesos Node.js activos:
echo.
powershell -NoProfile -Command ^
  "$procs=Get-Process node -ErrorAction SilentlyContinue;if($procs){$procs|ForEach-Object{Write-Host ('  PID '+$_.Id+' - '+[math]::Round($_.WorkingSet64/1MB,1)+' MB')}}else{Write-Host '  Sin procesos Node.js activos' -ForegroundColor Cyan}"

echo.
echo  Conexiones activas en puertos 3001, 3002, 4000:
powershell -NoProfile -Command ^
  "Get-NetTCPConnection -ErrorAction SilentlyContinue | Where-Object {$_.LocalPort -in 3001,3002,4000} | Format-Table LocalPort,RemoteAddress,RemotePort,State,OwningProcess -AutoSize"

echo.
pause
goto MENU

::-----------------------------------------------------------------
:MATAR_PUERTO
cls
echo.
echo  Matar proceso en un puerto especifico
echo.
set "PUERTO="
set /p PUERTO="  Ingresa el puerto a liberar (ej: 4000): "
echo.
powershell -NoProfile -Command ^
  "$p=Get-NetTCPConnection -LocalPort %PUERTO% -ErrorAction SilentlyContinue;if($p){$procId=$p[0].OwningProcess;Stop-Process -Id $procId -Force;Write-Host ('  [OK] Proceso PID '+$procId+' terminado en puerto %PUERTO%') -ForegroundColor Green}else{Write-Host '  [INFO] Puerto %PUERTO% ya estaba libre' -ForegroundColor Cyan}"
echo.
pause
goto MENU

::-----------------------------------------------------------------
:INSTALAR
cls
echo.
echo  Instalando dependencias del Backend...
echo.
cd /d "%~dp0backend"
npm install
echo.
echo  Instalando dependencias del Frontend...
echo.
cd /d "%~dp0frontend"
npm install
cd /d "%~dp0"
echo.
echo  Instalacion completada.
echo.
pause
goto MENU

::-----------------------------------------------------------------
:PRISMA_PUSH
cls
echo.
echo  ATENCION: Esto aplica el schema a la BD externa.
echo.
set "CONFIRM="
set /p CONFIRM="  Confirmar prisma db push? (s/n): "
if /i "%CONFIRM%"=="s" (
  cd /d "%~dp0backend"
  npx prisma db push
  cd /d "%~dp0"
  echo.
  echo  Push completado.
) else (
  echo  Cancelado.
)
echo.
pause
goto MENU

::-----------------------------------------------------------------
:PRISMA_GEN
cls
echo.
echo  Ejecutando prisma generate...
echo.
cd /d "%~dp0backend"
npx prisma generate
cd /d "%~dp0"
echo.
echo  Cliente Prisma regenerado.
echo.
pause
goto MENU

::-----------------------------------------------------------------
:MOVIL_EXT
cls
echo.
echo  Iniciando App Movil Flutter apuntando a IP externa...
echo   API:      http://34.71.132.26:3001/api
echo   App URL:  http://34.71.132.26:4000
echo  (Presiona CTRL+C para detener)
echo.
cd /d "%~dp0mobile"
C:\flutter\bin\flutter.bat run -d web-server --web-port 4000 --web-hostname 0.0.0.0 --dart-define=API_URL=http://34.71.132.26:3001/api --dart-define=PORTAL_URL=http://34.71.132.26:3002
cd /d "%~dp0"
echo.
pause
goto MENU

::-----------------------------------------------------------------
:TODOS_EXT
cls
echo.
echo  Iniciando servicios con IP externa en ventanas separadas...
start "iaDoS Backend :3001" cmd /k "cd /d %~dp0backend && node src/index.js"
start "iaDoS Frontend :3002 [EXT]" cmd /k "set NEXT_PUBLIC_API_URL=http://34.71.132.26:3001/api&& cd /d %~dp0frontend && npm run dev"
start "iaDoS App Movil :4000 [EXT]" cmd /k "cd /d %~dp0mobile && C:\flutter\bin\flutter.bat run -d web-server --web-port 4000 --web-hostname 0.0.0.0 --dart-define=API_URL=http://34.71.132.26:3001/api --dart-define=PORTAL_URL=http://34.71.132.26:3002"
echo.
echo   Backend   -^> http://34.71.132.26:3001/api/health
echo   Frontend  -^> http://34.71.132.26:3002
echo   App Movil -^> http://34.71.132.26:4000
echo.
goto MENU

::-----------------------------------------------------------------
:BUILD_APK
cls
echo.
echo  ================================================
echo   COMPILAR APK ANDROID  [%ENV_MODE%]
echo  ================================================
echo.
echo  API:    %APP_API_URL%
echo  Portal: %APP_PORTAL_URL%
echo  (Esto tarda varios minutos)
echo.
cd /d "%~dp0mobile"
C:\flutter\bin\flutter.bat build apk --release --dart-define=API_URL=%APP_API_URL% --dart-define=PORTAL_URL=%APP_PORTAL_URL%
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo  ERROR: La compilacion fallo.
  echo.
  cd /d "%~dp0"
  pause
  goto MENU
)
copy /Y "build\app\outputs\flutter-apk\app-release.apk" "build\app\outputs\flutter-apk\Acceso-Digital-iaDos.apk" >nul
echo.
echo  APK lista:
echo  mobile\build\app\outputs\flutter-apk\Acceso-Digital-iaDos.apk
echo.
cd /d "%~dp0"
pause
goto MENU

::-----------------------------------------------------------------
:ABRIR_PUERTOS
cls
echo.
echo  Abriendo puertos en Firewall de Windows...
echo  (Se requiere ejecutar este .bat como Administrador)
echo.
netsh advfirewall firewall delete rule name="iados-3001" >nul 2>&1
netsh advfirewall firewall delete rule name="iados-3002" >nul 2>&1
netsh advfirewall firewall delete rule name="iados-4000" >nul 2>&1
netsh advfirewall firewall add rule name="iados-3001" dir=in action=allow protocol=TCP localport=3001
netsh advfirewall firewall add rule name="iados-3002" dir=in action=allow protocol=TCP localport=3002
netsh advfirewall firewall add rule name="iados-4000" dir=in action=allow protocol=TCP localport=4000
echo.
echo  [OK] Puertos 3001, 3002, 4000 abiertos en Firewall de Windows.
echo.
echo  -------------------------------------------------------
echo  Firewall del VPS IONOS (74.208.149.7):
echo  -------------------------------------------------------
echo.
echo  El VPS ya tiene ufw configurado con puertos abiertos.
echo  Si necesitas verificar, usa opcion 18 (SSH al VPS) y ejecuta:
echo    ufw status
echo.
echo  URLs de acceso:
echo   Backend API  -^> http://74.208.149.7:3001/api/health
echo   Frontend     -^> http://74.208.149.7:3002
echo   App Movil    -^> http://74.208.149.7:4000
echo  -------------------------------------------------------
echo.
pause
goto MENU

::-----------------------------------------------------------------
:MOSQUITTO
cls
echo.
echo  ================================================
echo   MOSQUITTO MQTT BROKER
echo  ================================================
echo.
echo  Estado actual:
powershell -NoProfile -Command ^
  "$s=Get-Service mosquitto -ErrorAction SilentlyContinue;if($s){if($s.Status -eq 'Running'){Write-Host ('  [CORRIENDO] Mosquitto activo en puerto 1883') -ForegroundColor Green}else{Write-Host ('  [DETENIDO] Mosquitto no esta corriendo') -ForegroundColor Red}}else{Write-Host '  [NO INSTALADO] Mosquitto no encontrado' -ForegroundColor Red}"
echo.
echo  Clientes conectados (puerto 1883):
powershell -NoProfile -Command ^
  "$conns=Get-NetTCPConnection -LocalPort 1883 -State Established -ErrorAction SilentlyContinue;if($conns){Write-Host ('  ['+$conns.Count+' cliente(s) conectado(s)]') -ForegroundColor Cyan;$conns|ForEach-Object{Write-Host ('  - '+$_.RemoteAddress+':'+$_.RemotePort)}}else{Write-Host '  Sin clientes conectados' -ForegroundColor Yellow}"
echo.
echo  ------------------------------------------------
echo   Acciones:
echo    1. Iniciar Mosquitto
echo    2. Detener Mosquitto
echo    3. Reiniciar Mosquitto
echo    0. Volver al menu
echo  ------------------------------------------------
echo.
set "MOPT="
set /p MOPT="  Selecciona: "

if "%MOPT%"=="1" (
  net start mosquitto
  echo.
  pause
  goto MOSQUITTO
)
if "%MOPT%"=="2" (
  net stop mosquitto
  echo.
  pause
  goto MOSQUITTO
)
if "%MOPT%"=="3" (
  net stop mosquitto >nul 2>&1
  timeout /t 2 /nobreak >nul
  net start mosquitto
  echo.
  pause
  goto MOSQUITTO
)
goto MENU

::-----------------------------------------------------------------
::  VPS - PRODUCCION
::-----------------------------------------------------------------

:VPS_LOAD_CONFIG
:: Verificar que ssh este instalado
where ssh >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo  [ERROR] El cliente SSH no esta instalado o no esta en PATH.
  echo.
  echo  Para instalarlo, abre PowerShell como Administrador y ejecuta:
  echo    dism /online /Add-Capability /CapabilityName:OpenSSH.Client~~~~0.0.1.0
  echo.
  pause
  goto MENU
)
:: Carga la config del VPS (IP, usuario, clave)
if exist "%~dp0vps\vps.config.bat" (
  call "%~dp0vps\vps.config.bat"
) else (
  echo.
  echo  [ERROR] No se encontro vps\vps.config.bat
  echo.
  pause
  goto MENU
)
if "%VPS_IP%"=="X.X.X.X" (
  echo.
  echo  [ERROR] Edita vps\vps.config.bat con la IP real de tu VPS.
  echo.
  pause
  goto MENU
)
:: Armar argumentos SSH
set "SSH_KEY_ARG="
if not "%VPS_KEY%"=="" set "SSH_KEY_ARG=-i %VPS_KEY%"
set "SSH_OPTS=-o StrictHostKeyChecking=no -o ConnectTimeout=15"
goto :eof

::-----------------------------------------------------------------
:VPS_SSH
cls
call :VPS_LOAD_CONFIG
echo.
echo  Conectando al VPS %VPS_USER%@%VPS_IP%...
echo  (Escribe 'exit' para volver)
echo.
ssh %SSH_KEY_ARG% %SSH_OPTS% %VPS_USER%@%VPS_IP%
echo.
pause
goto MENU

::-----------------------------------------------------------------
:VPS_DEPLOY_WEB
cls
echo.
echo  ================================================
echo   DEPLOY BACKEND + FRONTEND al VPS  (via GitHub)
echo  ================================================
echo.
call :VPS_LOAD_CONFIG
echo  VPS: %VPS_USER%@%VPS_IP%
echo.
echo  PREREQUISITO: tus cambios deben estar en GitHub
echo  (git add + git commit + git push antes de esto)
echo.
set "CONFIRM="
set /p CONFIRM="  Confirmar deploy? (s/n): "
if /i not "%CONFIRM%"=="s" goto MENU

echo.
echo  Ejecutando en VPS: git pull + npm install + build + pm2 restart...
ssh %SSH_KEY_ARG% %SSH_OPTS% %VPS_USER%@%VPS_IP% "bash %VPS_DIR%/vps/deploy-server.sh"

echo.
echo  [OK] Deploy completado.
echo   Backend   -^> http://%VPS_IP%:3001/api/health
echo   Frontend  -^> http://%VPS_IP%:3002
echo.
pause
goto MENU

::-----------------------------------------------------------------
:VPS_DEPLOY_FLUTTER
cls
echo.
echo  ================================================
echo   BUILD FLUTTER WEB + DEPLOY al VPS
echo  ================================================
echo.
call :VPS_LOAD_CONFIG
set "FLUTTER_API_URL=http://%VPS_IP%:3001/api"
set "FLUTTER_PORTAL_URL=http://%VPS_IP%:3002"
if "%ENV_MODE%"=="DNS" set "FLUTTER_API_URL=https://accesodigitalapi.iados.mx/api"
if "%ENV_MODE%"=="DNS" set "FLUTTER_PORTAL_URL=https://accesodigital.iados.mx"
echo  VPS IP: %VPS_IP%
echo  API:    %FLUTTER_API_URL%
echo.

echo  [1/3] Compilando Flutter web para VPS...
cd /d "%~dp0mobile"
C:\flutter\bin\flutter.bat build web --release ^
  --dart-define=API_URL=%FLUTTER_API_URL% ^
  --dart-define=PORTAL_URL=%FLUTTER_PORTAL_URL%
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo  ERROR: Fallo la compilacion de Flutter.
  cd /d "%~dp0"
  pause
  goto MENU
)

echo  [2/3] Subiendo build/web al VPS...
scp %SSH_KEY_ARG% %SSH_OPTS% -r "build\web\." %VPS_USER%@%VPS_IP%:%VPS_DIR%/flutter-web/

echo  [3/3] Reiniciando iados-flutter en PM2...
ssh %SSH_KEY_ARG% %SSH_OPTS% %VPS_USER%@%VPS_IP% "bash %VPS_DIR%/vps/deploy-flutter.sh"

cd /d "%~dp0"
echo.
echo  [OK] Flutter web desplegado.
echo   App Movil -^> http://%VPS_IP%:4000
echo.
pause
goto MENU

::-----------------------------------------------------------------
:VPS_DEPLOY_ALL
cls
echo.
echo  ================================================
echo   DEPLOY COMPLETO al VPS
echo   Backend + Frontend (GitHub) + Flutter web
echo  ================================================
echo.
call :VPS_LOAD_CONFIG
set "FLUTTER_API_URL=http://%VPS_IP%:3001/api"
set "FLUTTER_PORTAL_URL=http://%VPS_IP%:3002"
if "%ENV_MODE%"=="DNS" set "FLUTTER_API_URL=https://accesodigitalapi.iados.mx/api"
if "%ENV_MODE%"=="DNS" set "FLUTTER_PORTAL_URL=https://accesodigital.iados.mx"
echo  PREREQUISITO: tus cambios deben estar en GitHub
echo  (git add + git commit + git push antes de esto)
echo.
set "CONFIRM="
set /p CONFIRM="  Confirmar deploy completo? (s/n): "
if /i not "%CONFIRM%"=="s" goto MENU

echo.
echo  [1] Backend + Frontend (git pull en VPS)...
ssh %SSH_KEY_ARG% %SSH_OPTS% %VPS_USER%@%VPS_IP% "bash %VPS_DIR%/vps/deploy-server.sh"

echo.
echo  [2] Flutter web (build local + scp)...
cd /d "%~dp0mobile"
C:\flutter\bin\flutter.bat build web --release ^
  --dart-define=API_URL=%FLUTTER_API_URL% ^
  --dart-define=PORTAL_URL=%FLUTTER_PORTAL_URL%
if %ERRORLEVEL% NEQ 0 (
  echo  ERROR: Fallo la compilacion Flutter.
  cd /d "%~dp0"
  pause
  goto MENU
)
scp %SSH_KEY_ARG% %SSH_OPTS% -r "build\web\." %VPS_USER%@%VPS_IP%:%VPS_DIR%/flutter-web/
ssh %SSH_KEY_ARG% %SSH_OPTS% %VPS_USER%@%VPS_IP% "bash %VPS_DIR%/vps/deploy-flutter.sh"
cd /d "%~dp0"

echo.
echo  [OK] Deploy completo terminado.
echo   Backend   -^> http://%VPS_IP%:3001/api/health
echo   Frontend  -^> http://%VPS_IP%:3002
echo   App Movil -^> http://%VPS_IP%:4000
echo.
pause
goto MENU

::-----------------------------------------------------------------
:VPS_STATUS
cls
echo.
echo  ================================================
echo   ESTADO DEL VPS
echo  ================================================
echo.
call :VPS_LOAD_CONFIG
echo  Conectando a %VPS_USER%@%VPS_IP%...
echo.
ssh %SSH_KEY_ARG% %SSH_OPTS% %VPS_USER%@%VPS_IP% "cd /opt/iados && echo '--- Docker ---' && docker compose ps && echo && echo '--- Flutter PM2 ---' && (pm2 describe iados-flutter 2>/dev/null | grep -E 'status|name' || echo '  iados-flutter: no encontrado') && echo && echo '--- Memoria ---' && free -h && echo && echo '--- Disco ---' && df -h / && echo && echo '--- Mosquitto ---' && (systemctl is-active mosquitto 2>/dev/null || echo INACTIVO)"
echo.
pause
goto MENU

::-----------------------------------------------------------------
:VPS_LOGS
cls
echo.
echo  ================================================
echo   LOGS DEL VPS (ultimas 80 lineas)
echo  ================================================
echo.
call :VPS_LOAD_CONFIG
echo  Mostrando logs... (CTRL+C para salir)
echo.
ssh %SSH_KEY_ARG% %SSH_OPTS% %VPS_USER%@%VPS_IP% "cd /opt/iados && docker compose logs --tail=80 --no-color 2>&1"
echo.
pause
goto MENU

::-----------------------------------------------------------------
:BUILD_APK_VPS
cls
echo.
echo  ================================================
echo   COMPILAR APK ANDROID  [%ENV_MODE%]
echo  ================================================
echo.
call :VPS_LOAD_CONFIG
set "FLUTTER_API_URL=http://%VPS_IP%:3001/api"
set "FLUTTER_PORTAL_URL=http://%VPS_IP%:3002"
if "%ENV_MODE%"=="DNS" set "FLUTTER_API_URL=https://accesodigitalapi.iados.mx/api"
if "%ENV_MODE%"=="DNS" set "FLUTTER_PORTAL_URL=https://accesodigital.iados.mx"

:: Leer version actual
set "CURRENT_VER="
set /p CURRENT_VER=<"%~dp0VERSION"
echo  Version actual: %CURRENT_VER%
echo.
set "APK_NAME="
set /p APK_NAME="  Nombre del APK (ej: AccesoDigital-v%CURRENT_VER%-cliente): "
if "%APK_NAME%"=="" set "APK_NAME=AccesoDigital-%CURRENT_VER%"

echo.
echo  Compilando APK apuntando a: %FLUTTER_API_URL%
echo  (Esto tarda varios minutos)
echo.
cd /d "%~dp0mobile"
C:\flutter\bin\flutter.bat build apk --release ^
  --dart-define=API_URL=%FLUTTER_API_URL% ^
  --dart-define=PORTAL_URL=%FLUTTER_PORTAL_URL%
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo  ERROR: La compilacion fallo.
  cd /d "%~dp0"
  pause
  goto MENU
)
copy /Y "build\app\outputs\flutter-apk\app-release.apk" "build\app\outputs\flutter-apk\%APK_NAME%.apk" >nul
echo.
echo  [OK] APK lista:
echo   mobile\build\app\outputs\flutter-apk\%APK_NAME%.apk
echo.
echo  API apuntando a: %FLUTTER_API_URL%
echo.
cd /d "%~dp0"
pause
goto MENU

::-----------------------------------------------------------------
:VERSION_BUMP
cls
echo.
echo  ================================================
echo   NUEVA VERSION
echo  ================================================
echo.
set "CURRENT_VER="
set /p CURRENT_VER=<"%~dp0VERSION"
echo  Version actual: %CURRENT_VER%
echo.
echo  Escribe la nueva version (ej: 1.1.0) o Enter para cancelar:
set "NEW_VER="
set /p NEW_VER="  Nueva version: "
if "%NEW_VER%"=="" (
  echo  Cancelado.
  pause
  goto MENU
)

:: Actualizar VERSION file
echo %NEW_VER%> "%~dp0VERSION"
echo.
echo  [1/4] VERSION actualizado a %NEW_VER%

:: Verificar estado de git
echo  [2/4] Estado git...
cd /d "%~dp0"
git add VERSION
git status --short

echo.
set "COMMIT_MSG="
set /p COMMIT_MSG="  Mensaje del commit (Enter = 'version %NEW_VER%'): "
if "%COMMIT_MSG%"=="" set "COMMIT_MSG=version %NEW_VER%"

git commit -m "%COMMIT_MSG%"
echo  [3/4] Commit creado.

echo  [4/4] Creando tag v%NEW_VER% y pusheando a GitHub...
git tag -a "v%NEW_VER%" -m "Version %NEW_VER%"
git push
git push origin "v%NEW_VER%"

echo.
echo  [OK] Version %NEW_VER% taggeada y publicada en GitHub.
echo  Ahora usa la opcion 19 o 21 para deployar al VPS.
echo.
pause
goto MENU

::-----------------------------------------------------------------
:SWITCH_ENV
cls
echo.
echo  ================================================
echo   CAMBIAR ENTORNO DE COMPILACION
echo  ================================================
echo.
echo  Entorno actual: %ENV_MODE%
echo.
echo   GCP (desarrollo): http://34.71.132.26:3001/api
echo   VPS (desarrollo): http://74.208.149.7:3001/api
echo   DNS (produccion): https://accesodigitalapi.iados.mx/api
echo.
echo   1. Cambiar a DNS  (para compilar y subir a GitHub)
echo   2. Cambiar a GCP  (para desarrollo local - VM Google Cloud)
echo   3. Cambiar a VPS  (para desarrollo local - VPS 74.208.149.7)
echo   0. Volver al menu
echo.
set "EOPT="
set /p EOPT="  Selecciona: "
if "%EOPT%"=="1" goto SWITCH_TO_DNS
if "%EOPT%"=="2" goto SWITCH_TO_GCP
if "%EOPT%"=="3" goto SWITCH_TO_VPS
goto MENU

:SWITCH_TO_DNS
echo DNS>"%~dp0vps\env-mode.txt"
echo.
echo  Actualizando workflow iOS...
powershell -NoProfile -Command ^
  "$f='%~dp0.github\workflows\build-ios.yml'; $c=[IO.File]::ReadAllText($f); $c=$c.Replace('http://34.71.132.26:3001/api','https://accesodigitalapi.iados.mx/api'); $c=$c.Replace('http://34.71.132.26:3002','https://accesodigital.iados.mx'); $c=$c.Replace('http://74.208.149.7:3001/api','https://accesodigitalapi.iados.mx/api'); $c=$c.Replace('http://74.208.149.7:3002','https://accesodigital.iados.mx'); [IO.File]::WriteAllText($f,$c)"
echo  Actualizando PORTAL_URL en backend...
powershell -NoProfile -Command ^
  "$f='%~dp0backend\.env'; $c=[IO.File]::ReadAllText($f); $c=$c -replace 'PORTAL_URL=.*','PORTAL_URL=https://accesodigital.iados.mx'; [IO.File]::WriteAllText($f,$c)"
echo  Actualizando PORTAL_URL en docker-compose...
powershell -NoProfile -Command ^
  "$f='%~dp0docker-compose.yml'; $c=[IO.File]::ReadAllText($f); $c=$c -replace 'PORTAL_URL=.*','PORTAL_URL=https://accesodigital.iados.mx'; [IO.File]::WriteAllText($f,$c)"
echo.
echo  [OK] Entorno cambiado a DNS (produccion)
echo.
echo  Recuerda:
echo   1. Compila APK (op.16), Flutter web (op.20/21) o APK VPS (op.24)
echo   2. git add + commit + push a GitHub
echo   3. Vuelve a VPS o GCP con opcion 26 cuando termines
echo.
pause
goto MENU

:SWITCH_TO_GCP
echo GCP>"%~dp0vps\env-mode.txt"
echo.
echo  Restaurando workflow iOS a GCP...
powershell -NoProfile -Command ^
  "$f='%~dp0.github\workflows\build-ios.yml'; $c=[IO.File]::ReadAllText($f); $c=$c.Replace('https://accesodigitalapi.iados.mx/api','http://34.71.132.26:3001/api'); $c=$c.Replace('https://accesodigital.iados.mx','http://34.71.132.26:3002'); $c=$c.Replace('http://74.208.149.7:3001/api','http://34.71.132.26:3001/api'); $c=$c.Replace('http://74.208.149.7:3002','http://34.71.132.26:3002'); [IO.File]::WriteAllText($f,$c)"
echo  Actualizando PORTAL_URL en backend...
powershell -NoProfile -Command ^
  "$f='%~dp0backend\.env'; $c=[IO.File]::ReadAllText($f); $c=$c -replace 'PORTAL_URL=.*','PORTAL_URL=http://34.71.132.26:3002'; [IO.File]::WriteAllText($f,$c)"
echo  Actualizando PORTAL_URL en docker-compose (GCP)...
powershell -NoProfile -Command ^
  "$f='%~dp0docker-compose.yml'; $c=[IO.File]::ReadAllText($f); $c=$c -replace 'PORTAL_URL=.*','PORTAL_URL=http://34.71.132.26:3002'; [IO.File]::WriteAllText($f,$c)"
echo  Actualizando MQTT en docker-compose (GCP)...
powershell -NoProfile -Command ^
  "$f='%~dp0docker-compose.yml'; $c=[IO.File]::ReadAllText($f); $c=$c.Replace('mqtt://host.docker.internal:1883','mqtt://74.208.149.7:1883'); [IO.File]::WriteAllText($f,$c)"
echo.
echo  [OK] Entorno cambiado a GCP (desarrollo)
echo.
pause
goto MENU

:SWITCH_TO_VPS
echo VPS>"%~dp0vps\env-mode.txt"
echo.
echo  Actualizando workflow iOS a VPS...
powershell -NoProfile -Command ^
  "$f='%~dp0.github\workflows\build-ios.yml'; $c=[IO.File]::ReadAllText($f); $c=$c.Replace('https://accesodigitalapi.iados.mx/api','http://74.208.149.7:3001/api'); $c=$c.Replace('https://accesodigital.iados.mx','http://74.208.149.7:3002'); $c=$c.Replace('http://34.71.132.26:3001/api','http://74.208.149.7:3001/api'); $c=$c.Replace('http://34.71.132.26:3002','http://74.208.149.7:3002'); [IO.File]::WriteAllText($f,$c)"
echo  Actualizando PORTAL_URL en backend...
powershell -NoProfile -Command ^
  "$f='%~dp0backend\.env'; $c=[IO.File]::ReadAllText($f); $c=$c -replace 'PORTAL_URL=.*','PORTAL_URL=http://74.208.149.7:3002'; [IO.File]::WriteAllText($f,$c)"
echo  Actualizando PORTAL_URL en docker-compose (VPS)...
powershell -NoProfile -Command ^
  "$f='%~dp0docker-compose.yml'; $c=[IO.File]::ReadAllText($f); $c=$c -replace 'PORTAL_URL=.*','PORTAL_URL=http://74.208.149.7:3002'; [IO.File]::WriteAllText($f,$c)"
echo  Actualizando MQTT en docker-compose (VPS)...
powershell -NoProfile -Command ^
  "$f='%~dp0docker-compose.yml'; $c=[IO.File]::ReadAllText($f); $c=$c.Replace('mqtt://74.208.149.7:1883','mqtt://host.docker.internal:1883'); [IO.File]::WriteAllText($f,$c)"
echo.
echo  [OK] Entorno cambiado a VPS (74.208.149.7)
echo.
pause
goto MENU

::-----------------------------------------------------------------
:FIN
cls
echo.
echo  Hasta luego.
echo.
exit /b 0
