const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const svc     = require('./advertising.service');
const { success, error } = require('../../utils/apiResponse');

// ── Multer config ─────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, '../../../uploads/ads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadsDir),
  filename: (_, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase() || '.jpg';
    const name = `ad_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'));
  },
}).single('image');

// ── Handlers ──────────────────────────────────────────────────────────────
async function list(req, res) {
  try {
    const onlyActive = req.query.active === 'true';
    return success(res, await svc.list(req.tenantId, onlyActive));
  } catch (err) { return error(res, err.message, err.status || 500); }
}

async function create(req, res) {
  try {
    return success(res, await svc.create(req.tenantId, req.body), 'Anuncio creado', 201);
  } catch (err) { return error(res, err.message, err.status || 500); }
}

async function update(req, res) {
  try {
    return success(res, await svc.update(req.tenantId, req.params.id, req.body), 'Anuncio actualizado');
  } catch (err) { return error(res, err.message, err.status || 500); }
}

async function remove(req, res) {
  try {
    return success(res, await svc.remove(req.tenantId, req.params.id), 'Anuncio eliminado');
  } catch (err) { return error(res, err.message, err.status || 500); }
}

async function reorder(req, res) {
  try {
    return success(res, await svc.reorder(req.tenantId, req.body.orderedIds), 'Orden actualizado');
  } catch (err) { return error(res, err.message, err.status || 500); }
}

function uploadImage(req, res) {
  upload(req, res, (err) => {
    if (err) return error(res, err.message, 400);
    if (!req.file) return error(res, 'No se recibió imagen', 400);
    const imageUrl = `/api/uploads/ads/${req.file.filename}`;
    return success(res, { imageUrl });
  });
}

module.exports = { list, create, update, remove, reorder, uploadImage };
