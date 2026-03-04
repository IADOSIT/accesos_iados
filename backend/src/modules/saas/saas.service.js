const prisma = require('../../config/database');

const MP_API = 'https://api.mercadopago.com';

// ── Helpers ────────────────────────────────────────────────────

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function periodDueDate(billingDay) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), billingDay);
}

async function getTenantSaasConfig(tenantId) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  if (!tenant) throw { status: 404, message: 'Tenant no encontrado' };
  const settings = tenant.settings || {};
  return settings.saasConfig || {};
}

async function updateSaasConfig(tenantId, data) {
  const current = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  const currentSettings = (current?.settings && typeof current.settings === 'object') ? current.settings : {};
  const currentSaas = currentSettings.saasConfig || {};

  return prisma.tenant.update({
    where: { id: tenantId },
    data: {
      settings: {
        ...currentSettings,
        saasConfig: { ...currentSaas, ...data },
      },
    },
    select: { id: true, settings: true },
  });
}

// ── Billing status ─────────────────────────────────────────────

async function getBillingStatus(tenantId) {
  const config = await getTenantSaasConfig(tenantId);

  const activeUnits = await prisma.unit.count({
    where: { tenantId, isActive: true },
  });

  const period = currentPeriod();
  const pricePerUnit = parseFloat(config.pricePerUnit || 0);
  const totalAmount = activeUnits * pricePerUnit;
  const billingDay = parseInt(config.billingDay || 1);
  const gracePeriodDays = parseInt(config.gracePeriodDays ?? 5);

  const now = new Date();
  const dueDate = periodDueDate(billingDay);
  const graceDue = new Date(dueDate);
  graceDue.setDate(graceDue.getDate() + gracePeriodDays);

  const currentPayment = await prisma.saasPayment.findUnique({
    where: { tenantId_period: { tenantId, period } },
  });

  const history = await prisma.saasPayment.findMany({
    where: { tenantId },
    orderBy: { period: 'desc' },
    take: 12,
  });

  const isOverdue = now > graceDue && (!currentPayment || currentPayment.status !== 'PAID');

  return {
    period,
    activeUnits,
    pricePerUnit,
    totalAmount,
    billingDay,
    gracePeriodDays,
    dueDate: dueDate.toISOString(),
    graceDue: graceDue.toISOString(),
    isOverdue,
    currentPayment: currentPayment || null,
    history,
    configured: !!(config.pricePerUnit && config.mpPublicKey && config.mpAccessToken),
  };
}

// ── MercadoPago ────────────────────────────────────────────────

async function createMPPreference(tenantId) {
  const config = await getTenantSaasConfig(tenantId);

  if (!config.mpAccessToken) {
    throw { status: 400, message: 'MercadoPago no está configurado para este fraccionamiento' };
  }

  const activeUnits = await prisma.unit.count({
    where: { tenantId, isActive: true },
  });

  const pricePerUnit = parseFloat(config.pricePerUnit || 0);
  const totalAmount = activeUnits * pricePerUnit;

  if (totalAmount <= 0) {
    throw { status: 400, message: 'El monto a cobrar es cero. Configura el precio por unidad.' };
  }

  const period = currentPeriod();
  const billingDay = parseInt(config.billingDay || 1);
  const dueDate = periodDueDate(billingDay);

  // Upsert SaasPayment record
  const saasPayment = await prisma.saasPayment.upsert({
    where: { tenantId_period: { tenantId, period } },
    create: { tenantId, period, activeUnits, pricePerUnit, totalAmount, dueDate, status: 'PENDING' },
    update: { activeUnits, pricePerUnit, totalAmount },
  });

  const portalUrl = process.env.PORTAL_URL || process.env.FRONTEND_URL || 'http://localhost:3002';
  const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;

  const preference = {
    items: [{
      id: saasPayment.id,
      title: `iaDoS — Servicio mensual ${period}`,
      quantity: 1,
      unit_price: totalAmount,
      currency_id: 'MXN',
    }],
    external_reference: saasPayment.id,
    back_urls: {
      success: `${portalUrl}/configuracion?mp_status=approved&mp_ref=${saasPayment.id}&tab=cobros`,
      failure: `${portalUrl}/configuracion?mp_status=failure&mp_ref=${saasPayment.id}&tab=cobros`,
      pending: `${portalUrl}/configuracion?mp_status=pending&mp_ref=${saasPayment.id}&tab=cobros`,
    },
    auto_return: 'approved',
    notification_url: `${backendUrl}/api/saas/webhook`,
  };

  const response = await fetch(`${MP_API}/checkout/preferences`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.mpAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(preference),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw { status: 400, message: `Error MercadoPago: ${errData.message || 'No se pudo crear la preferencia'}` };
  }

  const mpData = await response.json();

  await prisma.saasPayment.update({
    where: { id: saasPayment.id },
    data: { mpPreferenceId: mpData.id },
  });

  return {
    preferenceId: mpData.id,
    initPoint: mpData.init_point,
    sandboxInitPoint: mpData.sandbox_init_point,
    saasPaymentId: saasPayment.id,
    totalAmount,
    activeUnits,
    period,
  };
}

async function verifyAndMarkPaid(tenantId, saasPaymentId) {
  const config = await getTenantSaasConfig(tenantId);
  if (!config.mpAccessToken) {
    throw { status: 400, message: 'MercadoPago no configurado' };
  }

  const saasPayment = await prisma.saasPayment.findFirst({
    where: { id: saasPaymentId, tenantId },
  });
  if (!saasPayment) throw { status: 404, message: 'Registro de pago no encontrado' };
  if (saasPayment.status === 'PAID') return { ...saasPayment, verified: true };

  // Search by external_reference in MP
  const searchResp = await fetch(
    `${MP_API}/v1/payments/search?external_reference=${saasPaymentId}&status=approved`,
    { headers: { Authorization: `Bearer ${config.mpAccessToken}` } }
  );

  if (!searchResp.ok) {
    throw { status: 400, message: 'Error al verificar pago con MercadoPago' };
  }

  const searchData = await searchResp.json();
  const approved = (searchData.results || []);

  if (approved.length === 0) {
    return { ...saasPayment, verified: false };
  }

  const mpPayment = approved[0];
  const updated = await prisma.saasPayment.update({
    where: { id: saasPaymentId },
    data: { status: 'PAID', mpPaymentId: String(mpPayment.id), paidAt: new Date() },
  });

  return { ...updated, verified: true };
}

async function handleWebhook(body) {
  // MP sends: { type: 'payment', data: { id: 'MP_PAYMENT_ID' } }
  if (body.type !== 'payment' || !body.data?.id) return { ok: true };

  const mpPaymentId = String(body.data.id);

  // Find all tenants with mpAccessToken to look up the payment
  const tenants = await prisma.tenant.findMany({
    where: { isActive: true },
    select: { id: true, settings: true },
  });

  for (const tenant of tenants) {
    const saasConfig = (tenant.settings?.saasConfig) || {};
    if (!saasConfig.mpAccessToken) continue;

    try {
      const resp = await fetch(`${MP_API}/v1/payments/${mpPaymentId}`, {
        headers: { Authorization: `Bearer ${saasConfig.mpAccessToken}` },
      });
      if (!resp.ok) continue;

      const mpPayment = await resp.json();
      const externalRef = mpPayment.external_reference;
      if (!externalRef || mpPayment.status !== 'approved') continue;

      const saasPayment = await prisma.saasPayment.findFirst({
        where: { id: externalRef, tenantId: tenant.id },
      });

      if (saasPayment && saasPayment.status !== 'PAID') {
        await prisma.saasPayment.update({
          where: { id: externalRef },
          data: { status: 'PAID', mpPaymentId: String(mpPaymentId), paidAt: new Date() },
        });
      }
      break;
    } catch {
      // continue to next tenant
    }
  }

  return { ok: true };
}

module.exports = {
  getTenantSaasConfig,
  updateSaasConfig,
  getBillingStatus,
  createMPPreference,
  verifyAndMarkPaid,
  handleWebhook,
};
