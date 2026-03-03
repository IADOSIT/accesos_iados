function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page || '1', 10));
  const limit = Math.min(1000, Math.max(1, parseInt(query.limit || '20', 10)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

module.exports = { parsePagination };
