/**
 * Script de prueba: envía push FCM a un usuario por email.
 * Uso: node scripts/test-push.js daniel@iados.mx
 */
const prisma = require('../src/config/database');
const notif  = require('../src/services/notification');

const email = process.argv[2];
if (!email) { console.error('Uso: node scripts/test-push.js <email>'); process.exit(1); }

(async () => {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, firstName: true, fcmToken: true },
  });

  if (!user) { console.error(`Usuario no encontrado: ${email}`); process.exit(1); }

  console.log(`Usuario: ${user.firstName} (${email})`);
  console.log(`FCM token: ${user.fcmToken ? user.fcmToken.slice(0, 40) + '...' : 'SIN TOKEN'}`);

  if (!user.fcmToken) {
    console.error('El usuario no tiene token FCM. Debe iniciar sesión en la app primero.');
    process.exit(1);
  }

  // Buscar tenant del usuario
  const ut = await prisma.userTenant.findFirst({
    where: { userId: user.id, isActive: true },
    select: { tenantId: true },
  });

  await notif.sendToUser(
    user.id,
    ut?.tenantId ?? 'test',
    'MANUAL',
    '🔔 Prueba de notificación',
    `Hola ${user.firstName}, las notificaciones están funcionando correctamente.`,
    { test: 'true' },
  );

  console.log('Push enviado. Revisa el dispositivo.');
  await prisma.$disconnect();
})().catch(async e => {
  console.error(e.message);
  await prisma.$disconnect();
  process.exit(1);
});
