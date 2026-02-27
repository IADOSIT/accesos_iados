const { error } = require('../utils/apiResponse');

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
      return error(res, 'Datos inválidos', 400, details);
    }
    req.validated = result.data;
    next();
  };
}

module.exports = { validate };
