require('dotenv').config();
const pool = require('../config/db');

async function seedDemo() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [[admin]] = await connection.query("SELECT user_id FROM users_table WHERE username = 'admin' LIMIT 1");
    if (!admin) {
      throw new Error('Seed the admin account before demo data: npm run seed');
    }

    const demoBorrowers = [
      ['Maria', null, 'Santos', 'Poblacion, San Jose', '09170000001', 'Active', 'Clear', null],
      ['Juan', 'D.', 'Reyes', 'Rizal Street, San Jose', '09170000002', 'Active', 'Warning', 'Late payer on previous loan. Require manager review.'],
      ['Ana', null, 'Cruz', 'Mabini Avenue, San Jose', '09170000003', 'Inactive', 'Blacklisted', 'Do not approve new loans until balance dispute is resolved.']
    ];

    for (const borrower of demoBorrowers) {
      const [[existing]] = await connection.query(
        'SELECT borrower_id FROM borrowers_table WHERE contact_number = ? LIMIT 1',
        [borrower[4]]
      );

      if (existing) continue;

      const [borrowerResult] = await connection.query(
        `INSERT INTO borrowers_table
         (first_name, middle_name, last_name, address, contact_number, borrower_status, risk_status, warning_note, date_registered)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE())`,
        borrower
      );

      if (borrower[6] === 'Blacklisted') continue;

      const principal = borrower[0] === 'Juan' ? 7000 : 5000;
      const interest = borrower[0] === 'Juan' ? 700 : 500;
      const total = principal + interest;
      const payment = borrower[0] === 'Juan' ? 1000 : 2500;
      const balance = total - payment;

      const [loanResult] = await connection.query(
        `INSERT INTO loans_table
         (borrower_id, loan_date, due_date, principal_amount, interest_amount, total_amount, remaining_balance, loan_status)
         VALUES (?, DATE_SUB(CURDATE(), INTERVAL 10 DAY), DATE_ADD(CURDATE(), INTERVAL 20 DAY), ?, ?, ?, ?, 'Ongoing')`,
        [borrowerResult.insertId, principal, interest, total, balance]
      );

      const [paymentResult] = await connection.query(
        `INSERT INTO payments_table
         (loan_id, borrower_id, payment_date, payment_amount, updated_balance, payment_type, payment_method,
          reference_number, account_name, account_number, bank_name, encoded_by)
         VALUES (?, ?, CURDATE(), ?, ?, 'Partial', 'GCash', ?, ?, ?, NULL, ?)`,
        [
          loanResult.insertId,
          borrowerResult.insertId,
          payment,
          balance,
          `DEMO-${loanResult.insertId}`,
          `${borrower[0]} ${borrower[2]}`,
          borrower[4],
          admin.user_id
        ]
      );

      await connection.query(
        `INSERT INTO receipts_table (payment_id, receipt_date, borrower_id, amount_paid, remarks)
         VALUES (?, CURDATE(), ?, ?, ?)`,
        [paymentResult.insertId, borrowerResult.insertId, payment, 'Partial GCash demo payment']
      );
    }

    await connection.commit();
    console.log('Demo data seeded successfully.');
  } catch (error) {
    await connection.rollback();
    console.error(error);
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
}

seedDemo();
