const { Router } = require('express');
const { success } = require('../../utils/apiResponse');

const router = Router();

// Endpoint público — la app lo consulta al iniciar para verificar si hay actualización
router.get('/', (req, res) => {
  return success(res, {
    version:     process.env.APP_VERSION      || '1.1.0',
    buildNumber: parseInt(process.env.APP_BUILD_NUMBER || '2', 10),
    downloadUrl: process.env.APP_DOWNLOAD_URL || 'https://github.com/IADOSIT/accesos_iados/releases/latest',
    releaseNotes: process.env.APP_RELEASE_NOTES || '',
    mandatory:   process.env.APP_UPDATE_MANDATORY === 'true',
  });
});

module.exports = router;
