function success(res, data, message = 'OK', statusCode = 200) {
  return res.status(statusCode).json({ ok: true, message, data });
}

function error(res, message = 'Error interno', statusCode = 500, details = null) {
  const body = { ok: false, message };
  if (details) body.details = details;
  return res.status(statusCode).json(body);
}

function paginated(res, data, total, page, limit) {
  return res.status(200).json({
    ok: true,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}

module.exports = { success, error, paginated };
