const pool = require('../config/db');

async function recalculateLoanAfterPaymentChange(connection, loan) {
  const [payments] = await connection.query(
    'SELECT payment_id, payment_amount FROM payments_table WHERE loan_id = ? ORDER BY payment_date ASC, payment_id ASC',
    [loan.loan_id]
  );

  let balance = Number(loan.total_amount);
  for (const payment of payments) {
    balance = Math.max(balance - Number(payment.payment_amount), 0);
    await connection.query(
      'UPDATE payments_table SET updated_balance = ? WHERE payment_id = ?',
      [balance, payment.payment_id]
    );
  }

  const status = balance === 0 ? 'Paid' : loan.loan_status === 'Overdue' ? 'Overdue' : 'Ongoing';
  await connection.query(
    'UPDATE loans_table SET remaining_balance = ?, loan_status = ? WHERE loan_id = ?',
    [balance, status, loan.loan_id]
  );
}

exports.index = async (req, res) => {
  const [payments] = await pool.query(
    `SELECT p.*, r.receipt_id, CONCAT(b.first_name, ' ', b.last_name) AS borrower_name
     FROM payments_table p
     JOIN borrowers_table b ON b.borrower_id = p.borrower_id
     LEFT JOIN receipts_table r ON r.payment_id = p.payment_id
     ORDER BY p.payment_id DESC`
  );
  res.render('payments/index', { title: 'Payments', payments });
};

exports.createForm = async (req, res) => {
  const [loans] = await pool.query(
    `SELECT l.loan_id, l.remaining_balance, l.total_amount,
            CONCAT(b.first_name, ' ', b.last_name) AS borrower_name
     FROM loans_table l
     JOIN borrowers_table b ON b.borrower_id = l.borrower_id
     WHERE l.loan_status IN ('Ongoing', 'Overdue')
     ORDER BY l.loan_id DESC`
  );
  res.render('payments/create', { title: 'Record Payment', loans });
};

exports.store = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { loan_id, payment_date, payment_amount, payment_type } = req.body;
    const [[loan]] = await connection.query('SELECT * FROM loans_table WHERE loan_id = ? FOR UPDATE', [loan_id]);

    if (!loan) {
      throw new Error('Loan record not found.');
    }

    const amount = Number(payment_amount || 0);
    const updatedBalance = Math.max(Number(loan.remaining_balance) - amount, 0);
    const status = updatedBalance === 0 ? 'Paid' : 'Ongoing';

    const [paymentResult] = await connection.query(
      `INSERT INTO payments_table
       (loan_id, borrower_id, payment_date, payment_amount, updated_balance, payment_type, encoded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [loan.loan_id, loan.borrower_id, payment_date, amount, updatedBalance, payment_type, req.session.user.user_id]
    );

    await connection.query(
      'UPDATE loans_table SET remaining_balance = ?, loan_status = ? WHERE loan_id = ?',
      [updatedBalance, status, loan.loan_id]
    );

    const [receiptResult] = await connection.query(
      `INSERT INTO receipts_table (payment_id, receipt_date, borrower_id, amount_paid, remarks)
       VALUES (?, ?, ?, ?, ?)`,
      [paymentResult.insertId, payment_date, loan.borrower_id, amount, `${payment_type} payment`]
    );

    await connection.commit();
    req.flash('success', 'Payment recorded successfully.');
    return res.redirect(`/payments/${paymentResult.insertId}/receipt?receipt_id=${receiptResult.insertId}`);
  } catch (error) {
    await connection.rollback();
    console.error(error);
    req.flash('error', error.message || 'Unable to record payment.');
    return res.redirect('/payments/create');
  } finally {
    connection.release();
  }
};

exports.receipt = async (req, res) => {
  const [[payment]] = await pool.query(
    `SELECT p.*, r.receipt_id, r.receipt_date, r.amount_paid, r.remarks,
            l.total_amount, l.remaining_balance, l.loan_date,
            CONCAT(b.first_name, ' ', b.last_name) AS borrower_name,
            b.address, b.contact_number
     FROM payments_table p
     JOIN receipts_table r ON r.payment_id = p.payment_id
     JOIN loans_table l ON l.loan_id = p.loan_id
     JOIN borrowers_table b ON b.borrower_id = p.borrower_id
     WHERE p.payment_id = ?`,
    [req.params.id]
  );

  if (!payment) {
    req.flash('error', 'Receipt not found.');
    return res.redirect('/payments');
  }

  res.render('payments/receipt', { title: 'Payment Receipt', payment });
};

exports.destroy = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [[payment]] = await connection.query(
      `SELECT p.payment_id, p.loan_id, l.total_amount, l.loan_status
       FROM payments_table p
       JOIN loans_table l ON l.loan_id = p.loan_id
       WHERE p.payment_id = ?
       FOR UPDATE`,
      [req.params.id]
    );

    if (!payment) {
      await connection.rollback();
      req.flash('error', 'Payment record not found.');
      return res.redirect('/payments');
    }

    await connection.query('DELETE FROM receipts_table WHERE payment_id = ?', [req.params.id]);
    await connection.query('DELETE FROM payments_table WHERE payment_id = ?', [req.params.id]);
    await recalculateLoanAfterPaymentChange(connection, payment);

    await connection.commit();
    req.flash('success', 'Payment and receipt deleted successfully.');
    return res.redirect('/payments');
  } catch (error) {
    await connection.rollback();
    console.error(error);
    req.flash('error', 'Unable to delete payment record.');
    return res.redirect('/payments');
  } finally {
    connection.release();
  }
};
