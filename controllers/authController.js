const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { recordAudit } = require('../services/auditLogger');

exports.showLogin = (req, res) => {
  res.render('auth/login', { title: 'Login' });
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Input sanitization - reject suspicious input
    if (!username || typeof username !== 'string' || username.length > 100) {
      req.flash('error', 'Invalid username format.');
      return res.redirect('/login');
    }
    
    const sanitizedUsername = username.toLowerCase().trim();
    
    // Sanitize redirect URL to prevent open redirect attacks
    const safeRedirect = (url) => {
      if (!url || url.startsWith('/') && !url.startsWith('//')) {
        return url;
      }
      return '/dashboard';
    };
    
    const [rows] = await pool.query(
      'SELECT user_id, username, password, full_name, role, status FROM users_table WHERE username = ? LIMIT 1',
      [sanitizedUsername]
    );

    if (!rows.length) {
      await recordAudit(req, 'LOGIN_FAILED', 'user', null, { username: sanitizedUsername });
      req.flash('error', 'Invalid username or password.');
      return res.redirect('/login');
    }

    const user = rows[0];
    if (!user.status) {
      await recordAudit(req, 'LOGIN_INACTIVE', 'user', user.user_id, { username: sanitizedUsername });
      req.flash('error', 'This account is inactive.');
      return res.redirect('/login');
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      await recordAudit(req, 'LOGIN_FAILED', 'user', user.user_id, { username: sanitizedUsername });
      req.flash('error', 'Invalid username or password.');
      return res.redirect('/login');
    }

    req.session.regenerate((error) => {
      if (error) {
        console.error(error);
        req.flash('error', 'Unable to start a secure session.');
        return res.redirect('/login');
      }

      req.session.user = {
        user_id: user.user_id,
        username: user.username,
        full_name: user.full_name,
        role: user.role
      };

      req.loginSucceeded = true;
      recordAudit(req, 'LOGIN_SUCCESS', 'user', user.user_id, { username });

      req.flash('success', 'Login successful.');
      return res.redirect(safeRedirect('/dashboard'));
    });

    return undefined;
  } catch (error) {
    console.error(error);
    req.flash('error', 'Unable to log in. Check your database connection.');
    return res.redirect('/login');
  }
};

exports.logout = (req, res) => {
  const userId = req.session?.user?.user_id || null;
  recordAudit(req, 'LOGOUT', 'user', userId);
  req.session.destroy(() => {
    res.redirect('/login');
  });
};
