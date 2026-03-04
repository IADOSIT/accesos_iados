const svc = require('./payments.service');
const { success, error, paginated } = require('../../utils/apiResponse');
const { parsePagination } = require('../../utils/pagination');

async function createCharge(req, res) {
  try {
    const charge = await svc.createCharge(req.tenantId, req.validated);
    return success(res, charge, 'Cargo creado', 201);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function createPayment(req, res) {
  try {
    const payment = await svc.createPayment(req.tenantId, req.validated);
    return success(res, payment, 'Pago registrado', 201);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function getCharges(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  // RESIDENT solo ve cargos de su propia unidad
  const unitId = req.user.role === 'RESIDENT'
    ? req.user.unitId
    : req.query.unitId;
  const { data, total } = await svc.getCharges(req.tenantId, {
    skip, limit, unitId, status: req.query.status,
  });
  return paginated(res, data, total, page, limit);
}

async function getPayments(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await svc.getPayments(req.tenantId, {
    skip, limit, unitId: req.query.unitId, from: req.query.from, to: req.query.to,
  });
  return paginated(res, data, total, page, limit);
}

async function reconcile(req, res) {
  try {
    await svc.reconcile(req.tenantId, req.validated.paymentIds);
    return success(res, null, 'Pagos conciliados');
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

async function getDelinquent(req, res) {
  const data = await svc.getDelinquentUnits(req.tenantId);
  return success(res, data);
}

async function bulkPayments(req, res) {
  try {
    const result = await svc.bulkPayments(req.tenantId, req.body);
    return success(res, result, `${result.paid} pagos registrados`, 201);
  } catch (err) {
    return error(res, err.message, err.status || 500);
  }
}

module.exports = { createCharge, createPayment, getCharges, getPayments, reconcile, getDelinquent, bulkPayments };
