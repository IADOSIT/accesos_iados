const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const mqttService = require('./services/mqtt');

// Rutas
const authRoutes = require('./modules/auth/auth.routes');
const tenantRoutes = require('./modules/tenants/tenants.routes');
const userRoutes = require('./modules/users/users.routes');
const unitRoutes = require('./modules/units/units.routes');
const deviceRoutes = require('./modules/devices/devices.routes');
const accessRoutes = require('./modules/access/access.routes');
const paymentRoutes = require('./modules/payments/payments.routes');
const reportRoutes = require('./modules/reports/reports.routes');
const configRoutes = require('./modules/config/config.routes');
const notificationRoutes = require('./modules/notifications/notifications.routes');

const app = express();

// Seguridad
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    const allowed = [
      env.FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3003',
      'http://localhost:4000',
    ];
    // Permitir cualquier IP local (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    const isLocalNetwork = /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(origin);
    if (allowed.includes(origin) || isLocalNetwork) {
      callback(null, true);
    } else {
      callback(null, true); // En dev permitimos todo; cambiar a false en producción
    }
  },
  credentials: true,
}));

// Rate limiting global
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { ok: false, message: 'Demasiadas solicitudes, intenta más tarde' },
}));

// Rate limiting estricto para auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { ok: false, message: 'Demasiados intentos de autenticación' },
});

// Parseo
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'Acceso Digital - iaDoS API', timestamp: new Date().toISOString() });
});

// Rutas API
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/users', userRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/access', accessRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/config', configRoutes);
app.use('/api/notifications', notificationRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ ok: false, message: 'Ruta no encontrada' });
});

// Error global
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ ok: false, message: 'Error interno del servidor' });
});

// Iniciar servidor
app.listen(env.PORT, () => {
  console.log(`[iaDoS API] Servidor corriendo en puerto ${env.PORT}`);
  console.log(`[iaDoS API] Entorno: ${env.NODE_ENV}`);
  // Al conectar MQTT, suscribir al topic de estado de cada dispositivo
  // El Shelly Plus publica true/false en shellyXXXX/online al conectar/desconectar
  mqttService.connect(async () => {
    const prisma = require('./config/database');
    const devicesService = require('./modules/devices/devices.service');
    const notif = require('./services/notification');

    const devices = await prisma.device.findMany({
      where: { mqttTopic: { not: null }, isActive: true },
    });

    for (const device of devices) {
      const prefix = device.mqttTopic.split('/')[0]; // shellyplus1-A1B2C3
      const onlineTopic = `${prefix}/online`;

      mqttService.subscribe(onlineTopic, async (payload) => {
        const status = (payload === true || payload === 'true') ? 'ONLINE' : 'OFFLINE';
        await devicesService.updateStatus(device.id, status);
        console.log(`[MQTT] ${device.name} → ${status}`);
        if (status === 'OFFLINE') {
          notif.sendToRole(device.tenantId, 'ADMIN', 'DEVICE_OFFLINE', 'Dispositivo desconectado', `${device.name} está fuera de línea`, { deviceId: device.id });
        }
      });

      // Si el Shelly ya estaba conectado antes de que arrancara el backend,
      // no publica online/true de nuevo. Escuchamos sus eventos para marcarlo ONLINE
      mqttService.subscribe(`${prefix}/events/rpc`, async () => {
        await devicesService.updateStatus(device.id, 'ONLINE');
      });
    }

    console.log(`[MQTT] Monitoreando ${devices.length} dispositivo(s)`);
  });

  // Cron: limpieza diaria de QRs expirados hace más de 30 días
  const { cleanupExpiredQRs } = require('./modules/access/access.service');
  const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24h
  setTimeout(async () => {
    await cleanupExpiredQRs();
    setInterval(cleanupExpiredQRs, CLEANUP_INTERVAL);
  }, 60 * 1000); // primer cleanup 1 min después de arrancar
});

module.exports = app;
