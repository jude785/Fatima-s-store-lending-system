const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { ensureAuthenticated } = require('../middleware/auth');

router.get('/', ensureAuthenticated, paymentController.index);
router.get('/create', ensureAuthenticated, paymentController.createForm);
router.post('/', ensureAuthenticated, paymentController.store);
router.get('/:id/receipt', ensureAuthenticated, paymentController.receipt);
router.delete('/:id', ensureAuthenticated, paymentController.destroy);

module.exports = router;
