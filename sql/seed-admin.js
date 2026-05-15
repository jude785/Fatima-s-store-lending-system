require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { validatePasswordStrength } = require('../utils/passwordPolicy');

async function seedAdmin() {
  try {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      throw new Error('Set ADMIN_PASSWORD in your .env file before running npm run seed.');
    }
    validatePasswordStrength(adminPassword);

    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await pool.query(
      `INSERT INTO users_table (username, password, full_name, role, status)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE password = VALUES(password), full_name = VALUES(full_name), role = VALUES(role), status = VALUES(status)`,
      ['admin', passwordHash, 'System Administrator', 'Administrator', true]
    );
    console.log('Admin account seeded successfully.');
  } catch (error) {
    console.error(error);
  } finally {
    await pool.end();
  }
}

seedAdmin();
