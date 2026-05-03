const express = require('express');
const router = express.Router();
const borrowerController = require('../controllers/borrowerController');
const { ensureAuthenticated } = require('../middleware/auth');

router.get('/', ensureAuthenticated, borrowerController.index);
router.get('/create', ensureAuthenticated, borrowerController.createForm);
router.post('/', ensureAuthenticated, borrowerController.store);
router.get('/:id', ensureAuthenticated, borrowerController.show);
router.get('/:id/edit', ensureAuthenticated, borrowerController.editForm);
router.put('/:id', ensureAuthenticated, borrowerController.update);
router.delete('/:id', ensureAuthenticated, borrowerController.destroy);

module.exports = router;
