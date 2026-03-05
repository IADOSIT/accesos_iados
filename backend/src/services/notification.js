const prisma = require('../config/database');
const env = require('../config/env');

let messaging = null;

// Inicializar Firebase Admin — prioriza archivo montado (evita problemas de escaping)
if (env.FIREBASE_KEY_PATH || env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const admin = require('firebase-admin');
    let credential;
    if (env.FIREBASE_KEY_PATH) {
      credential = admin.credential.cert(env.FIREBASE_KEY_PATH);
      console.log('[FCM] Firebase Admin inicializado desde archivo:', env.FIREBASE_KEY_PATH);
    } else {
      const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      credential = admin.credential.cert(serviceAccount);
      console.log('[FCM] Firebase Admin inicializado desde variable de entorno');
    }
    admin.initializeApp({ credential });
    messaging = admin.messaging();
  } catch (err) {
    console.error('[FCM] Error inicializando Firebase Admin:', err.message);
  }
} else {
  console.log('[FCM] Sin configuración — notificaciones push desactivadas');
}

async function _send(fcmToken, title, body, data, type) {
  if (!messaging || !fcmToken) return;
  try {
    await messaging.send({
      token: fcmToken,
      notification: { title, body },
      data: {
        ...(data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : {}),
        type: type || '',
      },
      android: {
        priority: 'high',
        notification: { channelId: 'general_notifications' },
      },
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
      _send(user?.fcmToken, title, body, data, type),
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

// Envío urgente (pánico) con sonido en Android e iOS
async function _sendUrgent(fcmToken, title, body, data) {
  if (!messaging || !fcmToken) return;
  try {
    await messaging.send({
      token: fcmToken,
      notification: { title, body },
      data: data
        ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
        : {},
      android: {
        priority: 'high',
        notification: { sound: 'default', channelId: 'panic' },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1, 'interruption-level': 'time-sensitive' } },
        headers: { 'apns-priority': '10', 'apns-push-type': 'alert' },
      },
    });
  } catch (err) {
    console.error('[FCM] Error enviando push urgente:', err.message);
  }
}

// Envío de SERVICE_REQUEST: data-only en Android (dispara onBackgroundMessage → fullScreenIntent)
// iOS recibe alerta nativa via APNS con interruption-level time-sensitive
async function _sendServiceRequestPush(fcmToken, title, body, data) {
  if (!messaging || !fcmToken) return;
  try {
    const stringData = {
      ...(data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : {}),
      _title: title,
      _body: body,
    };
    await messaging.send({
      token: fcmToken,
      // Sin notification field → Android: data-only → _fcmBackgroundHandler se invoca
      data: stringData,
      android: { priority: 'high' },
      apns: {
        // iOS: alerta nativa visible en pantalla de bloqueo
        payload: {
          aps: {
            alert: { title, body },
            sound: 'default',
            badge: 1,
            'interruption-level': 'time-sensitive',
          },
        },
        headers: { 'apns-priority': '10', 'apns-push-type': 'alert' },
      },
    });
  } catch (err) {
    console.error('[FCM] Error enviando SERVICE_REQUEST push:', err.message);
  }
}

// Envía notificación urgente a todos los usuarios de un rol (fire-and-forget)
function sendUrgentToRole(tenantId, role, type, title, body, data) {
  (async () => {
    const memberships = await prisma.userTenant.findMany({
      where: { tenantId, role, isActive: true },
      select: { userId: true },
    });
    const userIds = [...new Set(memberships.map(m => m.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fcmToken: true },
    });
    await Promise.all(users.flatMap(u => [
      _sendUrgent(u.fcmToken, title, body, data),
      _save(tenantId, u.id, type, title, body, data),
    ]));
  })().catch(err => console.error('[FCM] sendUrgentToRole error:', err.message));
}

// Envía notificación urgente a todos los usuarios de una unidad (fire-and-forget)
function sendUrgentToUnit(tenantId, unitId, type, title, body, data) {
  (async () => {
    const residents = await prisma.userTenant.findMany({
      where: { tenantId, unitId, isActive: true },
      select: { userId: true },
    });
    const userIds = [...new Set(residents.map(r => r.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fcmToken: true },
    });
    await Promise.all(users.flatMap(u => [
      _sendUrgent(u.fcmToken, title, body, data),
      _save(tenantId, u.id, type, title, body, data),
    ]));
  })().catch(err => console.error('[FCM] sendUrgentToUnit error:', err.message));
}

// Envía SERVICE_REQUEST a todos los residentes de una unidad con push urgente de pantalla completa
function sendServiceRequestToUnit(tenantId, unitId, type, title, body, data) {
  (async () => {
    const residents = await prisma.userTenant.findMany({
      where: { tenantId, unitId, isActive: true },
      select: { userId: true },
    });
    const userIds = [...new Set(residents.map(r => r.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fcmToken: true },
    });
    await Promise.all(users.flatMap(u => [
      _sendServiceRequestPush(u.fcmToken, title, body, data),
      _save(tenantId, u.id, type, title, body, data),
    ]));
  })().catch(err => console.error('[FCM] sendServiceRequestToUnit error:', err.message));
}

module.exports = { sendToUser, sendToUnit, sendToRole, sendToAll, sendUrgentToRole, sendUrgentToUnit, sendServiceRequestToUnit };
