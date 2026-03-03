@echo off
chcp 65001 >nul 2>&1
title Acceso Digital - iaDoS

:MENU
cls
echo.
echo  ================================================
echo   ACCESO DIGITAL - iaDoS  ::  ENTORNO
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
echo  16. Compilar APK Android
echo.
echo  [ VPS - PRODUCCION ]
echo  18. SSH al VPS
echo  19. Deploy Backend + Frontend al VPS
echo  20. Build Flutter web + Deploy al VPS
echo  21. Deploy TODO al VPS (backend + frontend + flutter)
echo  22. Estado del VPS  (pm2 list)
echo  23. Logs del VPS    (pm2 logs --lines 80)
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
echo  Iniciando Backend en ventana separada...
start "iaDoS Backend :3001" cmd /k "cd /d %~dp0backend && node src/index.js"
timeout /t 3 /nobreak >nul
echo  Iniciando Frontend en ventana separada...
start "iaDoS Frontend :3002" cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 3 /nobreak >nul
echo  Iniciando App Movil en ventana separada...
start "iaDoS App Movil :4000" cmd /k "cd /d %~dp0mobile && C:\flutter\bin\flutter.bat run -d web-server --web-port 4000 --web-hostname 0.0.0.0"
echo.
echo  Todos los servicios iniciados:
echo   Backend   -^> http://localhost:3001/api/health
echo   Frontend  -^> http://localhost:3002
echo   App Movil -^> http://localhost:4000
echo.
pause
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
echo  Iniciando TODOS los servicios con IP externa...
echo.
start "iaDoS Backend :3001" cmd /k "cd /d %~dp0backend && node src/index.js"
timeout /t 3 /nobreak >nul
start "iaDoS Frontend :3002 [EXT]" cmd /k "set NEXT_PUBLIC_API_URL=http://34.71.132.26:3001/api&& cd /d %~dp0frontend && npm run dev"
timeout /t 3 /nobreak >nul
start "iaDoS App Movil :4000 [EXT]" cmd /k "cd /d %~dp0mobile && C:\flutter\bin\flutter.bat run -d web-server --web-port 4000 --web-hostname 0.0.0.0 --dart-define=API_URL=http://34.71.132.26:3001/api --dart-define=PORTAL_URL=http://34.71.132.26:3002"
echo.
echo  Servicios iniciados (acceso externo):
echo   Backend   -^> http://34.71.132.26:3001/api/health
echo   Frontend  -^> http://34.71.132.26:3002
echo   App Movil -^> http://34.71.132.26:4000
echo.
pause
goto MENU

::-----------------------------------------------------------------
:BUILD_APK
cls
echo.
echo  ================================================
echo   COMPILAR APK ANDROID
echo  ================================================
echo.
echo  Compilando APK con IP externa 34.71.132.26...
echo  (Esto tarda varios minutos)
echo.
cd /d "%~dp0mobile"
C:\flutter\bin\flutter.bat build apk --release --dart-define=API_URL=http://34.71.132.26:3001/api --dart-define=PORTAL_URL=http://34.71.132.26:3002
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
echo  [OK] Puertos abiertos en Windows Firewall: 3001, 3002, 4000
echo.
echo  -------------------------------------------------------
echo  Ahora abre estas reglas en GCP (Firewall de la VM):
echo  -------------------------------------------------------
echo.
echo  Ve a: GCP Console ^> VPC Network ^> Firewall
echo  Crea 3 reglas Ingress con estos datos:
echo.
echo  Nombre:          iados-backend
echo  Direccion:       Ingress
echo  Accion:          Allow
echo  Targets:         All instances in network
echo  Source IP:       0.0.0.0/0
echo  Protocolos:      TCP
echo  Puertos:         3001
echo.
echo  Nombre:          iados-frontend
echo  Puertos:         3002
echo.
echo  Nombre:          iados-movil
echo  Puertos:         4000
echo.
echo  -------------------------------------------------------
echo  URLs de acceso desde fuera:
echo   Backend API  -^> http://34.71.132.26:3001/api/health
echo   Frontend     -^> http://34.71.132.26:3002
echo   App Movil    -^> http://34.71.132.26:4000
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
:: ═══════════════════════════════════════════════════════════════
::  VPS - PRODUCCION
:: ═══════════════════════════════════════════════════════════════

:VPS_LOAD_CONFIG
:: Carga la config del VPS (IP, usuario, clave)
if exist "%~dp0vps\vps.config.bat" (
  call "%~dp0vps\vps.config.bat"
) else (
  echo.
  echo  [ERROR] No se encontro vps\vps.config.bat
  echo  Copia vps\vps.config.bat.example y edita con tu IP y usuario.
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
:: Armar argumento de clave SSH
set "SSH_KEY_ARG="
if not "%VPS_KEY%"=="" set "SSH_KEY_ARG=-i %VPS_KEY%"
goto :eof

::-----------------------------------------------------------------
:VPS_SSH
cls
echo.
echo  Conectando al VPS %VPS_IP%...
echo  (Escribe 'exit' para volver)
echo.
call :VPS_LOAD_CONFIG
ssh %SSH_KEY_ARG% %VPS_USER%@%VPS_IP%
echo.
pause
goto MENU

::-----------------------------------------------------------------
:VPS_DEPLOY_WEB
cls
echo.
echo  ================================================
echo   DEPLOY BACKEND + FRONTEND al VPS
echo  ================================================
echo.
call :VPS_LOAD_CONFIG
echo  VPS: %VPS_USER%@%VPS_IP%  Dir: %VPS_DIR%
echo.

echo  [1/4] Subiendo backend (src + prisma + package.json)...
scp %SSH_KEY_ARG% -r "%~dp0backend\src" %VPS_USER%@%VPS_IP%:%VPS_DIR%/backend/
scp %SSH_KEY_ARG% -r "%~dp0backend\prisma" %VPS_USER%@%VPS_IP%:%VPS_DIR%/backend/
scp %SSH_KEY_ARG% "%~dp0backend\package.json" %VPS_USER%@%VPS_IP%:%VPS_DIR%/backend/
scp %SSH_KEY_ARG% "%~dp0backend\package-lock.json" %VPS_USER%@%VPS_IP%:%VPS_DIR%/backend/ 2>nul

echo  [2/4] Subiendo frontend (src + public + config)...
scp %SSH_KEY_ARG% -r "%~dp0frontend\src" %VPS_USER%@%VPS_IP%:%VPS_DIR%/frontend/
scp %SSH_KEY_ARG% -r "%~dp0frontend\public" %VPS_USER%@%VPS_IP%:%VPS_DIR%/frontend/ 2>nul
scp %SSH_KEY_ARG% "%~dp0frontend\package.json" %VPS_USER%@%VPS_IP%:%VPS_DIR%/frontend/
scp %SSH_KEY_ARG% "%~dp0frontend\package-lock.json" %VPS_USER%@%VPS_IP%:%VPS_DIR%/frontend/ 2>nul
scp %SSH_KEY_ARG% "%~dp0frontend\next.config.*" %VPS_USER%@%VPS_IP%:%VPS_DIR%/frontend/ 2>nul
scp %SSH_KEY_ARG% "%~dp0frontend\tailwind.config.*" %VPS_USER%@%VPS_IP%:%VPS_DIR%/frontend/ 2>nul
scp %SSH_KEY_ARG% "%~dp0frontend\postcss.config.*" %VPS_USER%@%VPS_IP%:%VPS_DIR%/frontend/ 2>nul
scp %SSH_KEY_ARG% "%~dp0frontend\tsconfig.json" %VPS_USER%@%VPS_IP%:%VPS_DIR%/frontend/ 2>nul

echo  [3/4] Subiendo scripts del VPS...
scp %SSH_KEY_ARG% "%~dp0vps\ecosystem.config.js" %VPS_USER%@%VPS_IP%:%VPS_DIR%/
scp %SSH_KEY_ARG% "%~dp0vps\deploy-server.sh" %VPS_USER%@%VPS_IP%:%VPS_DIR%/
ssh %SSH_KEY_ARG% %VPS_USER%@%VPS_IP% "chmod +x %VPS_DIR%/deploy-server.sh"

echo  [4/4] Instalando deps + build + reiniciando PM2 en VPS...
ssh %SSH_KEY_ARG% %VPS_USER%@%VPS_IP% "bash %VPS_DIR%/deploy-server.sh"

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
echo  VPS IP: %VPS_IP%
echo.

echo  [1/3] Compilando Flutter web para VPS...
cd /d "%~dp0mobile"
C:\flutter\bin\flutter.bat build web --release ^
  --dart-define=API_URL=http://%VPS_IP%:3001/api ^
  --dart-define=PORTAL_URL=http://%VPS_IP%:3002
if %ERRORLEVEL% NEQ 0 (
  echo  ERROR: Fallo la compilacion de Flutter.
  cd /d "%~dp0"
  pause
  goto MENU
)

echo  [2/3] Subiendo build/web al VPS...
scp %SSH_KEY_ARG% -r "build\web\." %VPS_USER%@%VPS_IP%:%VPS_DIR%/flutter-web/

echo  [3/3] Reiniciando iados-flutter en PM2...
ssh %SSH_KEY_ARG% %VPS_USER%@%VPS_IP% "pm2 list | grep -q iados-flutter && pm2 restart iados-flutter || pm2 start %VPS_DIR%/ecosystem.config.js --only iados-flutter && pm2 save --force"

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
echo   DEPLOY COMPLETO al VPS (Backend+Frontend+Flutter)
echo  ================================================
echo.
call :VPS_LOAD_CONFIG
echo  Esto ejecutara las opciones 19 y 20 en secuencia.
echo.
set "CONFIRM="
set /p CONFIRM="  Confirmar deploy completo? (s/n): "
if /i not "%CONFIRM%"=="s" goto MENU

call :VPS_DEPLOY_WEB_INLINE
call :VPS_DEPLOY_FLUTTER_INLINE

echo.
echo  [OK] Deploy completo terminado.
echo   Backend   -^> http://%VPS_IP%:3001/api/health
echo   Frontend  -^> http://%VPS_IP%:3002
echo   App Movil -^> http://%VPS_IP%:4000
echo.
pause
goto MENU

:VPS_DEPLOY_WEB_INLINE
echo  [Backend/Frontend] Subiendo archivos...
scp %SSH_KEY_ARG% -r "%~dp0backend\src" %VPS_USER%@%VPS_IP%:%VPS_DIR%/backend/ >nul
scp %SSH_KEY_ARG% -r "%~dp0backend\prisma" %VPS_USER%@%VPS_IP%:%VPS_DIR%/backend/ >nul
scp %SSH_KEY_ARG% "%~dp0backend\package.json" %VPS_USER%@%VPS_IP%:%VPS_DIR%/backend/ >nul
scp %SSH_KEY_ARG% -r "%~dp0frontend\src" %VPS_USER%@%VPS_IP%:%VPS_DIR%/frontend/ >nul
scp %SSH_KEY_ARG% -r "%~dp0frontend\public" %VPS_USER%@%VPS_IP%:%VPS_DIR%/frontend/ >nul 2>nul
scp %SSH_KEY_ARG% "%~dp0frontend\package.json" %VPS_USER%@%VPS_IP%:%VPS_DIR%/frontend/ >nul
scp %SSH_KEY_ARG% "%~dp0frontend\next.config.*" %VPS_USER%@%VPS_IP%:%VPS_DIR%/frontend/ >nul 2>nul
scp %SSH_KEY_ARG% "%~dp0frontend\tailwind.config.*" %VPS_USER%@%VPS_IP%:%VPS_DIR%/frontend/ >nul 2>nul
scp %SSH_KEY_ARG% "%~dp0frontend\tsconfig.json" %VPS_USER%@%VPS_IP%:%VPS_DIR%/frontend/ >nul 2>nul
scp %SSH_KEY_ARG% "%~dp0vps\ecosystem.config.js" %VPS_USER%@%VPS_IP%:%VPS_DIR%/ >nul
scp %SSH_KEY_ARG% "%~dp0vps\deploy-server.sh" %VPS_USER%@%VPS_IP%:%VPS_DIR%/ >nul
ssh %SSH_KEY_ARG% %VPS_USER%@%VPS_IP% "chmod +x %VPS_DIR%/deploy-server.sh" >nul
echo  [Backend/Frontend] Instalando + reiniciando...
ssh %SSH_KEY_ARG% %VPS_USER%@%VPS_IP% "bash %VPS_DIR%/deploy-server.sh"
goto :eof

:VPS_DEPLOY_FLUTTER_INLINE
echo  [Flutter] Compilando...
cd /d "%~dp0mobile"
C:\flutter\bin\flutter.bat build web --release --dart-define=API_URL=http://%VPS_IP%:3001/api --dart-define=PORTAL_URL=http://%VPS_IP%:3002
echo  [Flutter] Subiendo...
scp %SSH_KEY_ARG% -r "build\web\." %VPS_USER%@%VPS_IP%:%VPS_DIR%/flutter-web/ >nul
ssh %SSH_KEY_ARG% %VPS_USER%@%VPS_IP% "pm2 list | grep -q iados-flutter && pm2 restart iados-flutter || pm2 start %VPS_DIR%/ecosystem.config.js --only iados-flutter && pm2 save --force >/dev/null 2>&1"
cd /d "%~dp0"
goto :eof

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
ssh %SSH_KEY_ARG% %VPS_USER%@%VPS_IP% "pm2 list && echo '' && echo '--- Memoria ---' && free -h && echo '' && echo '--- Disco ---' && df -h / && echo '' && echo '--- Mosquitto ---' && systemctl is-active mosquitto && echo '  MQTT activo en puerto 1883'"
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
ssh %SSH_KEY_ARG% %VPS_USER%@%VPS_IP% "pm2 logs --lines 80 --nostream"
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
