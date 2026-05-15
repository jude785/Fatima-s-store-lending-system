const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { redirectIfAuthenticated } = require('../middleware/auth');
const { createLoginRateLimiter } = require('../middleware/rateLimiter');

const loginRateLimiter = createLoginRateLimiter();

router.get('/login', redirectIfAuthenticated, authController.showLogin);
router.post('/login', redirectIfAuthenticated, loginRateLimiter, authController.login);
router.post('/logout', authController.logout);

module.exports = router;
