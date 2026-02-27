const svc = require('./reports.service');
const { success, error } = require('../../utils/apiResponse');

async function dashboard(req, res) {
  const data = await svc.dashboard(req.tenantId);
  return success(res, data);
}

async function accessByRange(req, res) {
  const data = await svc.accessByRange(req.tenantId, req.query.from, req.query.to);
  return success(res, data);
}

async function paymentsByPeriod(req, res) {
  const data = await svc.paymentsByPeriod(req.tenantId, req.query.from, req.query.to);
  return success(res, data);
}

async function delinquency(req, res) {
  const data = await svc.delinquencyReport(req.tenantId);
  return success(res, data);
}

async function guardActivity(req, res) {
  const data = await svc.guardActivity(req.tenantId, req.query.from, req.query.to);
  return success(res, data);
}

async function unitUsage(req, res) {
  const data = await svc.unitUsage(req.tenantId, req.query.from, req.query.to);
  return success(res, data);
}

module.exports = { dashboard, accessByRange, paymentsByPeriod, delinquency, guardActivity, unitUsage };
