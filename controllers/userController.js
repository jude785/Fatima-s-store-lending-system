const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { recordAudit } = require('../services/auditLogger');
const { validatePasswordStrength } = require('../utils/passwordPolicy');

const ROLES = ['Administrator', 'Staff'];

function cleanRequired(value, label) {
  const text = String(value || '').trim();
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

function normalizeStatus(value) {
  return value === '1' || value === 'true' || value === true;
}

function validateRole(role) {
  if (!ROLES.includes(role)) throw new Error('Invalid user role selected.');
  return role;
}

exports.index = async (req, res) => {
  const [users] = await pool.query(
    `SELECT user_id, username, full_name, role, status, created_at
     FROM users_table
     ORDER BY user_id ASC`
  );
  res.render('users/index', { title: 'Users', users });
};

exports.createForm = (req, res) => {
  res.render('users/create', { title: 'Create User', roles: ROLES });
};

exports.store = async (req, res) => {
  try {
    const username = cleanRequired(req.body.username, 'Username');
    const fullName = cleanRequired(req.body.full_name, 'Full name');
    const role = validateRole(cleanRequired(req.body.role, 'Role'));
    const password = cleanRequired(req.body.password, 'Password');
    validatePasswordStrength(password);

    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await pool.query(
      `INSERT INTO users_table (username, password, full_name, role, status)
       VALUES (?, ?, ?, ?, ?)`,
      [username, passwordHash, fullName, role, normalizeStatus(req.body.status)]
    );

    await recordAudit(req, 'USER_CREATED', 'user', result.insertId, { username, role });
    req.flash('success', 'User account created successfully.');
    return res.redirect('/users');
  } catch (error) {
    console.error(error);
    req.flash('error', error.code === 'ER_DUP_ENTRY' ? 'Username already exists.' : error.message || 'Unable to create user.');
    return res.redirect('/users/create');
  }
};

exports.editForm = async (req, res) => {
  const [[user]] = await pool.query(
    'SELECT user_id, username, full_name, role, status FROM users_table WHERE user_id = ?',
    [req.params.id]
  );

  if (!user) {
    req.flash('error', 'User account not found.');
    return res.redirect('/users');
  }

  res.render('users/edit', { title: 'Edit User', user, roles: ROLES });
};

exports.update = async (req, res) => {
  try {
    const fullName = cleanRequired(req.body.full_name, 'Full name');
    const role = validateRole(cleanRequired(req.body.role, 'Role'));
    const status = normalizeStatus(req.body.status);

    if (Number(req.params.id) === Number(req.session.user.user_id) && !status) {
      throw new Error('You cannot deactivate your own account.');
    }

    const password = String(req.body.password || '');
    if (password.trim()) {
      validatePasswordStrength(password);
      const passwordHash = await bcrypt.hash(password, 12);
      await pool.query(
        'UPDATE users_table SET full_name = ?, role = ?, status = ?, password = ? WHERE user_id = ?',
        [fullName, role, status, passwordHash, req.params.id]
      );
    } else {
      await pool.query(
        'UPDATE users_table SET full_name = ?, role = ?, status = ? WHERE user_id = ?',
        [fullName, role, status, req.params.id]
      );
    }

    await recordAudit(req, 'USER_UPDATED', 'user', req.params.id, { role, status });
    req.flash('success', 'User account updated successfully.');
    return res.redirect('/users');
  } catch (error) {
    console.error(error);
    req.flash('error', error.message || 'Unable to update user.');
    return res.redirect(`/users/${req.params.id}/edit`);
  }
};

exports.destroy = async (req, res) => {
  try {
    if (Number(req.params.id) === Number(req.session.user.user_id)) {
      throw new Error('You cannot deactivate your own account.');
    }

    const [result] = await pool.query('UPDATE users_table SET status = FALSE WHERE user_id = ?', [req.params.id]);
    if (!result.affectedRows) {
      req.flash('error', 'User account not found.');
      return res.redirect('/users');
    }

    await recordAudit(req, 'USER_DEACTIVATED', 'user', req.params.id);
    req.flash('success', 'User account deactivated.');
    return res.redirect('/users');
  } catch (error) {
    console.error(error);
    req.flash('error', error.message || 'Unable to deactivate user.');
    return res.redirect('/users');
  }
};
