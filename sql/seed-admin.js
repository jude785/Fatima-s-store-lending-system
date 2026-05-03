require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function seedAdmin() {
  try {
    const passwordHash = await bcrypt.hash('admin123', 10);
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
