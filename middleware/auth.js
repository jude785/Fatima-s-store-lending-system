function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    res.locals.currentUser = req.session.user;
    return next();
  }
  req.flash('error', 'Please log in first.');
  return res.redirect('/login');
}

function redirectIfAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return res.redirect('/dashboard');
  }
  next();
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const role = req.session?.user?.role;
    if (allowedRoles.includes(role)) return next();

    req.flash('error', 'You do not have permission to access that page.');
    return res.status(403).render('errors/403', { title: 'Forbidden' });
  };
}

module.exports = { ensureAuthenticated, redirectIfAuthenticated, requireRole };
