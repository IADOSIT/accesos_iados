/**
 * seed-demo.js — Datos de demostración para mostrar volumen a clientes.
 *
 * Crea:
 *   • 100 casas  (identifier: DEMO-001…DEMO-100, ownerName inicia con "[DEMO]")
 *   • 100 usuarios residentes (email: demo.res###@demo.iados.mx, contraseña: Demo1234!)
 *   • 2 entradas en Guía Amarilla (negocios locales Guadalupe NL)
 *   • 1 anuncio publicitario (área Plutarco Elias Calles, Guadalupe NL)
 *
 * Uso:
 *   node scripts/seed-demo.js                        — usa el primer tenant activo
 *   node scripts/seed-demo.js <slug-del-tenant>      — tenant específico
 *
 * Para eliminar todo: node scripts/cleanup-demo.js
 */

const prisma  = require('../src/config/database');
const bcrypt  = require('bcryptjs');

// ─── Datos realistas (nombres mexicanos) ─────────────────────────────────────
const NOMBRES = [
  'Carlos','María','Juan','Ana','Luis','Laura','Jorge','Patricia',
  'Roberto','Claudia','Miguel','Sofía','Alejandro','Gabriela','Fernando',
  'Valeria','Eduardo','Fernanda','Ricardo','Daniela','Arturo','Sandra',
  'Héctor','Verónica','Marco','Leticia','Óscar','Adriana','Rubén','Mónica',
  'David','Silvia','Enrique','Rosa','Manuel','Elena','Sergio','Teresa',
  'Pablo','Norma','Raúl','Diana','Víctor','Martha','Alfredo','Alicia',
  'Gerardo','Irene','Jesús','Lucía','Armando','Beatriz','Francisco',
  'Griselda','Ernesto','Pilar','Ignacio','Cecilia','Rodrigo','Natalia',
  'Salvador','Liliana','Gustavo','Rebeca','Mauricio','Karla','Abel',
  'Margarita','Nicolás','Esperanza','Emilio','Guadalupe','Benjamín','Blanca',
  'Tomás','Lourdes','Andrés','Yolanda','Gonzalo','Consuelo','Hugo','Isabel',
  'Adolfo','Esmeralda','Gilberto','Patricia','Teodoro','Angélica','Ramón',
  'Josefina','Felipe','Hortensia','Edmundo','Dolores','Aurelio','Eunice',
];

const APELLIDOS = [
  'García','Hernández','Martínez','López','González','Rodríguez','Pérez',
  'Sánchez','Ramírez','Flores','Torres','Rivera','Cruz','Ortiz','Morales',
  'Gutiérrez','Chávez','Ramos','Mendoza','Jiménez','Álvarez','Castillo',
  'Castro','Reyes','Vargas','Navarro','Aguilar','Moreno','Romero','Ríos',
  'Delgado','Salinas','Vázquez','Medina','Leal','Guerrero','Estrada',
  'Zamora','Fuentes','Suárez','Garza','Luna','Coronado','Esquivel',
  'Ávila','Valdés','Contreras','Domínguez','Cabrera','Herrera',
];

// ─── 2 Negocios locales (Guadalupe NL, zona Plutarco Elias Calles) ────────────
const NEGOCIOS_DEMO = [
  {
    name:        'Farmacia San Marcos',
    category:    'Salud',
    phone:       '8113425678',
    whatsapp:    '528113425678',
    description: 'Farmacia con médico general, surtido de recetas y servicio a domicilio. Blvd. Plutarco Elias Calles, Guadalupe NL.',
    emoji:       '💊',
    isActive:    true,
    order:       90,
  },
  {
    name:        'Taquería El Rincón Norteño',
    category:    'Restaurantes',
    phone:       '8118763412',
    whatsapp:    '528118763412',
    description: 'Tacos de carne asada, arrachera y costilla. Abierto todos los días de 7am a 12am. Colonia Plutarco Elias Calles, Guadalupe NL.',
    emoji:       '🌮',
    isActive:    true,
    order:       91,
  },
];

// ─── Publicidad (anuncio del área) ────────────────────────────────────────────
const ANUNCIO_DEMO = {
  businessName: 'Remodelaciones Garza — Guadalupe NL',
  phone:        '8112345678',
  whatsapp:     '528112345678',
  address:      'Blvd. Plutarco Elias Calles, Guadalupe, Nuevo León',
  description:  'Pisos, azulejos, pintura y cancelería de aluminio. Presupuesto sin costo. Servicio para colonias Plutarco Elias Calles y zonas aledañas.',
  isActive:     true,
  order:        0,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function pick(arr, i) { return arr[i % arr.length]; }

function demoEmail(n) {
  return `demo.res${String(n).padStart(3,'0')}@demo.iados.mx`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
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
        console.log('\nUsa: node scripts/seed-demo.js <slug>');
        process.exit(0);
      }
      tenant = tenants[0];
    }
    console.log(`\n✅ Tenant: ${tenant.name} (${tenant.slug})\n`);

    // 2. Hash de contraseña demo
    const passwordHash = await bcrypt.hash('Demo1234!', 10);

    // 3. Crear 100 unidades DEMO
    console.log('🏠 Creando 100 unidades de demo...');
    let unitsCreated = 0;
    const unitIds = [];
    for (let i = 1; i <= 100; i++) {
      const identifier = `DEMO-${String(i).padStart(3,'0')}`;
      const existing = await prisma.unit.findUnique({
        where: { tenantId_identifier: { tenantId: tenant.id, identifier } },
      });
      if (existing) {
        unitIds.push(existing.id);
        continue;
      }
      const u = await prisma.unit.create({
        data: {
          tenantId:   tenant.id,
          identifier,
          block:      `Manzana ${String.fromCharCode(65 + Math.floor((i-1)/10))}`, // A–J
          ownerName:  `[DEMO] ${pick(NOMBRES, i+7)} ${pick(APELLIDOS, i)} ${pick(APELLIDOS, i+3)}`,
          ownerPhone: `811${String(8000000 + i * 997).slice(0,7)}`,
          ownerEmail: demoEmail(i),
          isActive:   true,
        },
      });
      unitIds.push(u.id);
      unitsCreated++;
    }
    console.log(`   ${unitsCreated} nuevas | ${100 - unitsCreated} ya existían\n`);

    // 4. Crear 100 usuarios + UserTenant + asignar unidad
    console.log('👤 Creando 100 usuarios residentes demo...');
    let usersCreated = 0;
    for (let i = 1; i <= 100; i++) {
      const email = demoEmail(i);
      const firstName = pick(NOMBRES, i + 13);
      const lastName  = `${pick(APELLIDOS, i + 5)} ${pick(APELLIDOS, i + 21)}`;

      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            passwordHash,
            firstName,
            lastName,
            phone:    `811${String(9000000 + i * 997).slice(0,7)}`,
            isActive: true,
          },
        });
        usersCreated++;
      }

      // UserTenant (RESIDENT vinculado a su unidad DEMO)
      const existing = await prisma.userTenant.findUnique({
        where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
      });
      if (!existing) {
        await prisma.userTenant.create({
          data: {
            userId:   user.id,
            tenantId: tenant.id,
            role:     'RESIDENT',
            unitId:   unitIds[i - 1],
            isActive: true,
          },
        });
      }
    }
    console.log(`   ${usersCreated} nuevos | ${100 - usersCreated} ya existían\n`);

    // 5. Guía Amarilla — 2 negocios
    console.log('📒 Creando 2 negocios en Guía Amarilla...');
    for (const negocio of NEGOCIOS_DEMO) {
      const existing = await prisma.guiaAmarillaEntry.findFirst({
        where: { tenantId: tenant.id, name: negocio.name },
      });
      if (!existing) {
        await prisma.guiaAmarillaEntry.create({ data: { tenantId: tenant.id, ...negocio } });
        console.log(`   ✅ ${negocio.name}`);
      } else {
        console.log(`   ⏭  ${negocio.name} (ya existe)`);
      }
    }

    // 6. Publicidad
    console.log('\n📢 Creando anuncio publicitario...');
    const existingAd = await prisma.advertisement.findFirst({
      where: { tenantId: tenant.id, businessName: ANUNCIO_DEMO.businessName },
    });
    if (!existingAd) {
      await prisma.advertisement.create({ data: { tenantId: tenant.id, ...ANUNCIO_DEMO } });
      console.log(`   ✅ ${ANUNCIO_DEMO.businessName}`);
    } else {
      console.log(`   ⏭  ${ANUNCIO_DEMO.businessName} (ya existe)`);
    }

    console.log('\n🎉 Seed demo completado.');
    console.log('   Para eliminar: node scripts/cleanup-demo.js\n');
    console.log('   Credenciales demo:');
    console.log('   Email:    demo.res001@demo.iados.mx  …  demo.res100@demo.iados.mx');
    console.log('   Password: Demo1234!\n');

    await prisma.$disconnect();
  } catch (e) {
    console.error('Error:', e.message);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
