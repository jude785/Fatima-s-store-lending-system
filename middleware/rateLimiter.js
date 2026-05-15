function createLoginRateLimiter(options = {}) {
  const windowMs = options.windowMs || 15 * 60 * 1000;
  const maxAttempts = options.maxAttempts || 5;
  const attempts = new Map();

  return function loginRateLimiter(req, res, next) {
    const username = String(req.body.username || '').toLowerCase().trim();
    const key = `${req.ip || req.socket.remoteAddress || 'unknown'}:${username}`;
    const now = Date.now();
    const record = attempts.get(key) || { count: 0, firstAttemptAt: now };

    if (now - record.firstAttemptAt > windowMs) {
      record.count = 0;
      record.firstAttemptAt = now;
    }

    if (record.count >= maxAttempts) {
      req.flash('error', 'Too many login attempts. Please wait a few minutes and try again.');
      return res.redirect('/login');
    }

    res.on('finish', () => {
      if (req.loginSucceeded) {
        attempts.delete(key);
        return;
      }

      if (res.statusCode < 400 && res.statusCode >= 300) {
        record.count += 1;
        attempts.set(key, record);
      }
    });

    next();
  };
}

module.exports = { createLoginRateLimiter };
