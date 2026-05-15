const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { ensureAuthenticated, requireRole } = require('../middleware/auth');

router.use(ensureAuthenticated, requireRole('Administrator'));

router.get('/', userController.index);
router.get('/create', userController.createForm);
router.post('/', userController.store);
router.get('/:id/edit', userController.editForm);
router.put('/:id', userController.update);
router.delete('/:id', userController.destroy);

module.exports = router;
