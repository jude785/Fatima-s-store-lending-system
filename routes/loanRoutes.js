const express = require('express');
const router = express.Router();
const loanController = require('../controllers/loanController');
const { ensureAuthenticated } = require('../middleware/auth');

router.get('/', ensureAuthenticated, loanController.index);
router.get('/create', ensureAuthenticated, loanController.createForm);
router.post('/', ensureAuthenticated, loanController.store);
router.get('/:id', ensureAuthenticated, loanController.show);
router.get('/:id/edit', ensureAuthenticated, loanController.editForm);
router.put('/:id', ensureAuthenticated, loanController.update);
router.delete('/:id', ensureAuthenticated, loanController.destroy);

module.exports = router;
