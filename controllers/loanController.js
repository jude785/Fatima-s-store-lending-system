const pool = require('../config/db');

exports.index = async (req, res) => {
  const [loans] = await pool.query(
    `SELECT l.*, CONCAT(b.first_name, ' ', b.last_name) AS borrower_name
     FROM loans_table l
     JOIN borrowers_table b ON b.borrower_id = l.borrower_id
     ORDER BY l.loan_id DESC`
  );
  res.render('loans/index', { title: 'Loans', loans });
};

exports.createForm = async (req, res) => {
  const [borrowers] = await pool.query(
    "SELECT borrower_id, first_name, last_name FROM borrowers_table WHERE borrower_status = 'Active' ORDER BY last_name ASC"
  );
  res.render('loans/create', { title: 'New Loan', borrowers });
};

exports.store = async (req, res) => {
  const { borrower_id, loan_date, due_date, principal_amount, interest_amount } = req.body;
  const principal = Number(principal_amount || 0);
  const interest = Number(interest_amount || 0);
  const total = principal + interest;

  await pool.query(
    `INSERT INTO loans_table
     (borrower_id, loan_date, due_date, principal_amount, interest_amount, total_amount, remaining_balance, loan_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'Ongoing')`,
    [borrower_id, loan_date, due_date, principal, interest, total, total]
  );

  req.flash('success', 'Loan recorded successfully.');
  res.redirect('/loans');
};

exports.show = async (req, res) => {
  const [[loan]] = await pool.query(
    `SELECT l.*, CONCAT(b.first_name, ' ', b.last_name) AS borrower_name, b.contact_number, b.address
     FROM loans_table l
     JOIN borrowers_table b ON b.borrower_id = l.borrower_id
     WHERE l.loan_id = ?`,
    [req.params.id]
  );

  if (!loan) {
    req.flash('error', 'Loan record not found.');
    return res.redirect('/loans');
  }

  const [payments] = await pool.query(
    'SELECT * FROM payments_table WHERE loan_id = ? ORDER BY payment_id DESC',
    [req.params.id]
  );

  res.render('loans/show', { title: 'Loan Details', loan, payments });
};

exports.editForm = async (req, res) => {
  const [[loan]] = await pool.query('SELECT * FROM loans_table WHERE loan_id = ?', [req.params.id]);
  const [borrowers] = await pool.query('SELECT borrower_id, first_name, last_name FROM borrowers_table ORDER BY last_name ASC');
  if (!loan) {
    req.flash('error', 'Loan record not found.');
    return res.redirect('/loans');
  }
  res.render('loans/edit', { title: 'Edit Loan', loan, borrowers });
};

exports.update = async (req, res) => {
  const { borrower_id, loan_date, due_date, principal_amount, interest_amount, loan_status } = req.body;
  const principal = Number(principal_amount || 0);
  const interest = Number(interest_amount || 0);
  const total = principal + interest;

  const [[existing]] = await pool.query('SELECT remaining_balance FROM loans_table WHERE loan_id = ?', [req.params.id]);
  const remaining = Math.min(Number(existing?.remaining_balance || total), total);

  await pool.query(
    `UPDATE loans_table
     SET borrower_id = ?, loan_date = ?, due_date = ?, principal_amount = ?, interest_amount = ?,
         total_amount = ?, remaining_balance = ?, loan_status = ?
     WHERE loan_id = ?`,
    [borrower_id, loan_date, due_date, principal, interest, total, remaining, loan_status, req.params.id]
  );

  req.flash('success', 'Loan updated successfully.');
  res.redirect('/loans');
};

exports.destroy = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [[loan]] = await connection.query(
      'SELECT loan_id FROM loans_table WHERE loan_id = ? FOR UPDATE',
      [req.params.id]
    );

    if (!loan) {
      await connection.rollback();
      req.flash('error', 'Loan record not found.');
      return res.redirect('/loans');
    }

    await connection.query(
      `DELETE r FROM receipts_table r
       JOIN payments_table p ON p.payment_id = r.payment_id
       WHERE p.loan_id = ?`,
      [req.params.id]
    );
    await connection.query('DELETE FROM payments_table WHERE loan_id = ?', [req.params.id]);
    await connection.query('DELETE FROM loans_table WHERE loan_id = ?', [req.params.id]);

    await connection.commit();
    req.flash('success', 'Loan and related payment records deleted successfully.');
    return res.redirect('/loans');
  } catch (error) {
    await connection.rollback();
    console.error(error);
    req.flash('error', 'Unable to delete loan record.');
    return res.redirect('/loans');
  } finally {
    connection.release();
  }
};
