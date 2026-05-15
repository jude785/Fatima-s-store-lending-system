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
