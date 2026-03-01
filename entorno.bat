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
echo  [ ACCESO EXTERNO - IP: 34.71.132.26 ]
echo  13. App Movil - IP externa   (Flutter web apunta a 34.71.132.26:3001)
echo  14. Abrir puertos - Firewall Windows (3001, 3002, 4000)
echo  15. Levantar TODO con IP externa (3 ventanas)
echo  16. Compilar APK Android
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
C:\flutter\bin\flutter.bat run -d web-server --web-port 4000 --web-hostname 0.0.0.0 --dart-define=API_URL=http://34.71.132.26:3001/api
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
start "iaDoS App Movil :4000 [EXT]" cmd /k "cd /d %~dp0mobile && C:\flutter\bin\flutter.bat run -d web-server --web-port 4000 --web-hostname 0.0.0.0 --dart-define=API_URL=http://34.71.132.26:3001/api"
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
C:\flutter\bin\flutter.bat build apk --release --dart-define=API_URL=http://34.71.132.26:3001/api
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
:FIN
cls
echo.
echo  Hasta luego.
echo.
exit /b 0
