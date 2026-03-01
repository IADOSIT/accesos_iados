const prisma = require('../config/database');
const env = require('../config/env');

let messaging = null;

// Inicializar Firebase Admin solo si existe la configuración
if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const admin = require('firebase-admin');
    const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    messaging = admin.messaging();
    console.log('[FCM] Firebase Admin inicializado');
  } catch (err) {
    console.error('[FCM] Error inicializando Firebase Admin:', err.message);
  }
} else {
  console.log('[FCM] Sin configuración — notificaciones push desactivadas');
}

async function _send(fcmToken, title, body, data) {
  if (!messaging || !fcmToken) return;
  try {
    await messaging.send({
      token: fcmToken,
      notification: { title, body },
      data: data
        ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
        : {},
      android: { priority: 'high' },
    });
  } catch (err) {
    console.error('[FCM] Error enviando push:', err.message);
  }
}

async function _save(tenantId, userId, type, title, body, data) {
  try {
    await prisma.notification.create({
      data: { tenantId, userId, type, title, body, data: data || null },
    });
  } catch (err) {
    console.error('[FCM] Error guardando notificación:', err.message);
  }
}

// Envía push y guarda en BD para un usuario específico
async function sendToUser(userId, tenantId, type, title, body, data) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });
    await Promise.all([
      _save(tenantId, userId, type, title, body, data),
      _send(user?.fcmToken, title, body, data),
    ]);
  } catch (err) {
    console.error('[FCM] sendToUser error:', err.message);
  }
}

// Envía a todos los usuarios de una unidad (fire-and-forget)
function sendToUnit(tenantId, unitId, type, title, body, data) {
  (async () => {
    const residents = await prisma.userTenant.findMany({
      where: { tenantId, unitId, isActive: true },
      select: { userId: true },
    });
    await Promise.all(residents.map(r => sendToUser(r.userId, tenantId, type, title, body, data)));
  })().catch(err => console.error('[FCM] sendToUnit error:', err.message));
}

// Envía a todos los usuarios con un rol en el tenant (fire-and-forget)
function sendToRole(tenantId, role, type, title, body, data) {
  (async () => {
    const users = await prisma.userTenant.findMany({
      where: { tenantId, role, isActive: true },
      select: { userId: true },
    });
    await Promise.all(users.map(u => sendToUser(u.userId, tenantId, type, title, body, data)));
  })().catch(err => console.error('[FCM] sendToRole error:', err.message));
}

// Envía a todos los usuarios del tenant (fire-and-forget)
function sendToAll(tenantId, type, title, body, data) {
  (async () => {
    const users = await prisma.userTenant.findMany({
      where: { tenantId, isActive: true },
      select: { userId: true },
    });
    const unique = [...new Map(users.map(u => [u.userId, u])).values()];
    await Promise.all(unique.map(u => sendToUser(u.userId, tenantId, type, title, body, data)));
  })().catch(err => console.error('[FCM] sendToAll error:', err.message));
}

module.exports = { sendToUser, sendToUnit, sendToRole, sendToAll };
