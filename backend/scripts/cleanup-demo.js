/**
 * cleanup-demo.js — Elimina ÚNICAMENTE los datos de demostración creados por seed-demo.js.
 *
 * Elimina:
 *   • Usuarios con email *@demo.iados.mx  (y en cascada sus UserTenant / DeviceSession)
 *   • Unidades con identifier DEMO-###    (y en cascada sus Charges, Payments, QRCodes, etc.)
 *   • Entradas Guía Amarilla: "Farmacia San Marcos" y "Taquería El Rincón Norteño"
 *   • Anuncio: "Remodelaciones Garza — Guadalupe NL"
 *
 * Uso:
 *   node scripts/cleanup-demo.js                        — usa el primer tenant activo
 *   node scripts/cleanup-demo.js <slug-del-tenant>      — tenant específico
 *
 * ⚠ Solo borra lo identificado como DEMO. No toca otros datos.
 */

const prisma = require('../src/config/database');

const GUIA_NAMES = [
  'Farmacia San Marcos',
  'Taquería El Rincón Norteño',
];

const AD_NAME = 'Remodelaciones Garza — Guadalupe NL';

(async () => {
  try {
    // 1. Obtener tenant
    const slugArg = process.argv[2];
    let tenant;
    if (slugArg) {
      tenant = await prisma.tenant.findUnique({ where: { slug: slugArg } });
      if (!tenant) { console.error(`❌ Tenant con slug "${slugArg}" no encontrado.`); process.exit(1); }
    } else {
      const tenants = await prisma.tenant.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
      if (!tenants.length) { console.error('❌ No hay tenants activos en la BD.'); process.exit(1); }
      if (tenants.length > 1) {
        console.log('Tenants disponibles:');
        tenants.forEach(t => console.log(`  • ${t.slug}  —  ${t.name}`));
        console.log('\nUsa: node scripts/cleanup-demo.js <slug>');
        process.exit(0);
      }
      tenant = tenants[0];
    }
    console.log(`\n🎯 Tenant: ${tenant.name} (${tenant.slug})\n`);

    // 2. Eliminar usuarios demo (cascade a UserTenant, DeviceSession)
    console.log('👤 Eliminando usuarios demo (@demo.iados.mx)...');
    const { count: deletedUsers } = await prisma.user.deleteMany({
      where: { email: { endsWith: '@demo.iados.mx' } },
    });
    console.log(`   ${deletedUsers} usuarios eliminados\n`);

    // 3. Eliminar unidades demo (identifier DEMO-### en este tenant)
    //    UserTenant ya fue eliminado en cascada por el User, así que podemos borrar la unidad.
    console.log('🏠 Eliminando unidades DEMO-###...');
    const { count: deletedUnits } = await prisma.unit.deleteMany({
      where: {
        tenantId:   tenant.id,
        identifier: { startsWith: 'DEMO-' },
      },
    });
    console.log(`   ${deletedUnits} unidades eliminadas\n`);

    // 4. Eliminar entradas Guía Amarilla demo
    console.log('📒 Eliminando negocios Guía Amarilla demo...');
    const { count: deletedGuia } = await prisma.guiaAmarillaEntry.deleteMany({
      where: {
        tenantId: tenant.id,
        name:     { in: GUIA_NAMES },
      },
    });
    console.log(`   ${deletedGuia} entradas eliminadas\n`);

    // 5. Eliminar anuncio demo
    console.log('📢 Eliminando anuncio demo...');
    const { count: deletedAds } = await prisma.advertisement.deleteMany({
      where: {
        tenantId:     tenant.id,
        businessName: AD_NAME,
      },
    });
    console.log(`   ${deletedAds} anuncios eliminados\n`);

    console.log('✅ Limpieza demo completa. Solo se eliminaron datos de demostración.\n');
    await prisma.$disconnect();
  } catch (e) {
    console.error('Error:', e.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
