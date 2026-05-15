const crypto = require('crypto');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function createToken() {
  return crypto.randomBytes(32).toString('hex');
}

function attachCsrfToken(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = createToken();
  }

  res.locals.csrfToken = req.session.csrfToken;
  res.locals.csrfField = `<input type="hidden" name="_csrf" value="${req.session.csrfToken}">`;
  next();
}

function verifyCsrfToken(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const submittedToken = req.body?._csrf || req.get('x-csrf-token');
  if (submittedToken && submittedToken === req.session.csrfToken) {
    return next();
  }

  req.flash('error', 'Security check failed. Please try again.');
  return res.status(403).render('errors/403', { title: 'Forbidden' });
}

module.exports = { attachCsrfToken, verifyCsrfToken };
