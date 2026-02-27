const jwt = require('jsonwebtoken');
const env = require('../config/env');
const prisma = require('../config/database');
const { error } = require('../utils/apiResponse');

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return error(res, 'Token requerido', 401);
  }

  try {
    const token = header.split(' ')[1];
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return error(res, 'Token inválido o expirado', 401);
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return error(res, 'No autenticado', 401);
    if (req.user.isSuperAdmin) return next();
    if (!roles.includes(req.user.role)) {
      return error(res, 'Sin permisos para esta acción', 403);
    }
    next();
  };
}

module.exports = { authenticate, authorize };
