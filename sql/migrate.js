require('dotenv').config();
const pool = require('../config/db');

async function columnExists(connection, tableName, columnName) {
  const [[row]] = await connection.query(
    `SELECT COUNT(*) AS total
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );

  return Number(row.total) > 0;
}

async function addColumnIfMissing(connection, tableName, columnName, definition) {
  if (await columnExists(connection, tableName, columnName)) return;
  await connection.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  console.log(`Added ${tableName}.${columnName}`);
}

async function ensureAuditLogsTable(connection) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS audit_logs_table (
      audit_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      action VARCHAR(80) NOT NULL,
      entity_type VARCHAR(80) NOT NULL,
      entity_id INT NULL,
      details TEXT NULL,
      ip_address VARCHAR(45) NULL,
      user_agent VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_entity (entity_type, entity_id),
      INDEX idx_audit_created_at (created_at),
      CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users_table(user_id)
        ON UPDATE CASCADE ON DELETE SET NULL
    )`
  );
}

async function runMigrations() {
  const connection = await pool.getConnection();
  try {
    await addColumnIfMissing(
      connection,
      'payments_table',
      'payment_method',
      "VARCHAR(30) NOT NULL DEFAULT 'Cash' AFTER payment_type"
    );
    await addColumnIfMissing(
      connection,
      'payments_table',
      'reference_number',
      'VARCHAR(100) NULL AFTER payment_method'
    );
    await addColumnIfMissing(
      connection,
      'payments_table',
      'account_name',
      'VARCHAR(100) NULL AFTER reference_number'
    );
    await addColumnIfMissing(
      connection,
      'payments_table',
      'account_number',
      'VARCHAR(50) NULL AFTER account_name'
    );
    await addColumnIfMissing(
      connection,
      'payments_table',
      'bank_name',
      'VARCHAR(100) NULL AFTER account_number'
    );

    await connection.query(
      "UPDATE payments_table SET payment_method = 'Cash' WHERE payment_method IS NULL OR payment_method = ''"
    );

    await addColumnIfMissing(
      connection,
      'borrowers_table',
      'risk_status',
      "VARCHAR(20) NOT NULL DEFAULT 'Clear' AFTER borrower_status"
    );
    await addColumnIfMissing(
      connection,
      'borrowers_table',
      'warning_note',
      'TEXT NULL AFTER risk_status'
    );
    await connection.query(
      "UPDATE borrowers_table SET risk_status = 'Clear' WHERE risk_status IS NULL OR risk_status = ''"
    );

    await ensureAuditLogsTable(connection);

    console.log('Database migrations completed.');
  } finally {
    connection.release();
    await pool.end();
  }
}

runMigrations().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
