const pool = require('../config/db');
const { recalculateLoanLedger } = require('../services/loanLedger');
const { isDateRangeValid, resolveLoanStatus, roundMoney } = require('../utils/loanAccounting');

const LOAN_STATUSES = ['Ongoing', 'Overdue', 'Paid'];

function validateLoanAmounts(principalAmount, interestAmount) {
  const principal = roundMoney(principalAmount);
  const interest = roundMoney(interestAmount || 0);

  if (!Number.isFinite(principal) || principal <= 0) {
    throw new Error('Principal amount must be greater than zero.');
  }

  if (!Number.isFinite(interest) || interest < 0) {
    throw new Error('Interest amount cannot be negative.');
  }

  return { principal, interest, total: roundMoney(principal + interest) };
}

function validateLoanDates(loanDate, dueDate) {
  if (!loanDate || !dueDate || !isDateRangeValid(loanDate, dueDate)) {
    throw new Error('Due date must be the same as or later than the loan date.');
  }
}

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
  try {
    const { borrower_id, loan_date, due_date, principal_amount, interest_amount } = req.body;
    validateLoanDates(loan_date, due_date);
    const { principal, interest, total } = validateLoanAmounts(principal_amount, interest_amount);

    const [[borrower]] = await pool.query(
      "SELECT borrower_id FROM borrowers_table WHERE borrower_id = ? AND borrower_status = 'Active'",
      [borrower_id]
    );

    if (!borrower) {
      throw new Error('Please select an active borrower.');
    }

    await pool.query(
      `INSERT INTO loans_table
       (borrower_id, loan_date, due_date, principal_amount, interest_amount, total_amount, remaining_balance, loan_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [borrower_id, loan_date, due_date, principal, interest, total, total, resolveLoanStatus(total, due_date)]
    );

    req.flash('success', 'Loan recorded successfully.');
    return res.redirect('/loans');
  } catch (error) {
    console.error(error);
    req.flash('error', error.message || 'Unable to record loan.');
    return res.redirect('/loans/create');
  }
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
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { borrower_id, loan_date, due_date, principal_amount, interest_amount, loan_status } = req.body;
    validateLoanDates(loan_date, due_date);

    if (!LOAN_STATUSES.includes(loan_status)) {
      throw new Error('Invalid loan status selected.');
    }

    const { principal, interest, total } = validateLoanAmounts(principal_amount, interest_amount);

    const [[existing]] = await connection.query(
      'SELECT * FROM loans_table WHERE loan_id = ? FOR UPDATE',
      [req.params.id]
    );

    if (!existing) {
      throw new Error('Loan record not found.');
    }

    const [[borrower]] = await connection.query(
      'SELECT borrower_id FROM borrowers_table WHERE borrower_id = ?',
      [borrower_id]
    );

    if (!borrower) {
      throw new Error('Selected borrower does not exist.');
    }

    const [existingPayments] = await connection.query(
      'SELECT payment_amount FROM payments_table WHERE loan_id = ? FOR UPDATE',
      [req.params.id]
    );

    const totalPaid = roundMoney(
      existingPayments.reduce((sum, payment) => sum + Number(payment.payment_amount), 0)
    );
    if (totalPaid > total) {
      throw new Error(`Loan total cannot be lower than payments already recorded (PHP ${totalPaid.toFixed(2)}).`);
    }

    if (loan_status === 'Paid' && totalPaid < total) {
      throw new Error('A loan can only be marked paid when recorded payments cover the full loan total.');
    }

    await connection.query(
      `UPDATE loans_table
       SET borrower_id = ?, loan_date = ?, due_date = ?, principal_amount = ?, interest_amount = ?,
           total_amount = ?
       WHERE loan_id = ?`,
      [borrower_id, loan_date, due_date, principal, interest, total, req.params.id]
    );

    if (Number(existing.borrower_id) !== Number(borrower_id)) {
      await connection.query('UPDATE payments_table SET borrower_id = ? WHERE loan_id = ?', [borrower_id, req.params.id]);
      await connection.query(
        `UPDATE receipts_table r
         JOIN payments_table p ON p.payment_id = r.payment_id
         SET r.borrower_id = ?
         WHERE p.loan_id = ?`,
        [borrower_id, req.params.id]
      );
    }

    await recalculateLoanLedger(
      connection,
      { loan_id: req.params.id, total_amount: total, due_date, loan_status },
      loan_status
    );

    await connection.commit();
    req.flash('success', 'Loan updated successfully.');
    return res.redirect('/loans');
  } catch (error) {
    await connection.rollback();
    console.error(error);
    req.flash('error', error.message || 'Unable to update loan.');
    return res.redirect(`/loans/${req.params.id}/edit`);
  } finally {
    connection.release();
  }
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
