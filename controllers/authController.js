const bcrypt = require('bcryptjs');
const pool = require('../config/db');

exports.showLogin = (req, res) => {
  res.render('auth/login', { title: 'Login' });
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const [rows] = await pool.query(
      'SELECT user_id, username, password, full_name, role, status FROM users_table WHERE username = ? LIMIT 1',
      [username]
    );

    if (!rows.length) {
      req.flash('error', 'Invalid username or password.');
      return res.redirect('/login');
    }

    const user = rows[0];
    if (!user.status) {
      req.flash('error', 'This account is inactive.');
      return res.redirect('/login');
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      req.flash('error', 'Invalid username or password.');
      return res.redirect('/login');
    }

    req.session.user = {
      user_id: user.user_id,
      username: user.username,
      full_name: user.full_name,
      role: user.role
    };

    req.flash('success', 'Login successful.');
    return res.redirect('/dashboard');
  } catch (error) {
    console.error(error);
    req.flash('error', 'Unable to log in. Check your database connection.');
    return res.redirect('/login');
  }
};

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
};
