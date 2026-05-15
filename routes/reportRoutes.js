const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { ensureAuthenticated } = require('../middleware/auth');

router.get('/', ensureAuthenticated, reportController.index);
router.get('/export.csv', ensureAuthenticated, reportController.exportCsv);
router.post('/save-summary', ensureAuthenticated, reportController.storeSummary);

module.exports = router;
