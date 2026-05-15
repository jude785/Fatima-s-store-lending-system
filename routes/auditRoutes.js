const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { ensureAuthenticated, requireRole } = require('../middleware/auth');

router.get('/', ensureAuthenticated, requireRole('Administrator'), auditController.index);

module.exports = router;
