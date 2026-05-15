const pool = require('../config/db');
const { recalculateLoanLedger } = require('../services/loanLedger');
const { resolveLoanStatus, roundMoney } = require('../utils/loanAccounting');

const PAYMENT_METHODS = ['Cash', 'GCash', 'Bank Transfer'];
const PAYMENT_TYPES = ['Partial', 'Full'];

function cleanText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function getPaymentDetails(body) {
  const paymentMethod = cleanText(body.payment_method) || 'Cash';
  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    throw new Error('Invalid payment method selected.');
  }

  const details = {
    paymentMethod,
    referenceNumber: cleanText(body.reference_number),
    accountName: cleanText(body.account_name),
    accountNumber: cleanText(body.account_number),
    bankName: cleanText(body.bank_name)
  };

  if (paymentMethod === 'Cash') {
    return {
      ...details,
      referenceNumber: null,
      accountName: null,
      accountNumber: null,
      bankName: null
    };
  }

  if (!details.referenceNumber) {
    throw new Error('Reference number is required for GCash and bank payments.');
  }

  if (!details.accountName || !details.accountNumber) {
    throw new Error('Account name and account number are required for GCash and bank payments.');
  }

  if (paymentMethod === 'Bank Transfer' && !details.bankName) {
    throw new Error('Bank name is required for bank account payments.');
  }

  if (paymentMethod === 'GCash') {
    details.bankName = null;
  }

  return details;
}

function buildReceiptRemarks(paymentType, paymentMethod, referenceNumber) {
  if (paymentMethod === 'Cash') return `${paymentType} cash payment`;
  return `${paymentType} ${paymentMethod} payment - Ref: ${referenceNumber}`;
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
       AND l.remaining_balance > 0
     ORDER BY l.loan_id DESC`
  );
  res.render('payments/create', { title: 'Record Payment', loans, paymentMethods: PAYMENT_METHODS });
};

exports.store = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { loan_id, payment_date, payment_amount, payment_type } = req.body;
    if (!loan_id || !payment_date) {
      throw new Error('Loan record and payment date are required.');
    }

    if (!PAYMENT_TYPES.includes(payment_type)) {
      throw new Error('Invalid payment type selected.');
    }

    const [[loan]] = await connection.query(
      'SELECT * FROM loans_table WHERE loan_id = ? FOR UPDATE',
      [loan_id]
    );

    if (!loan) {
      throw new Error('Loan record not found.');
    }

    const currentBalance = roundMoney(loan.remaining_balance);
    if (currentBalance <= 0 || loan.loan_status === 'Paid') {
      throw new Error('This loan is already fully paid.');
    }

    const amount = roundMoney(payment_amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }

    if (amount > currentBalance) {
      throw new Error(`Payment amount cannot exceed the remaining balance of PHP ${currentBalance.toFixed(2)}.`);
    }

    if (payment_type === 'Full' && amount !== currentBalance) {
      throw new Error('Full payment amount must equal the remaining loan balance.');
    }

    const paymentDetails = getPaymentDetails(req.body);
    const updatedBalance = roundMoney(currentBalance - amount);
    const paymentType = updatedBalance <= 0 ? 'Full' : 'Partial';
    const status = resolveLoanStatus(updatedBalance, loan.due_date, loan.loan_status);

    const [paymentResult] = await connection.query(
      `INSERT INTO payments_table
       (loan_id, borrower_id, payment_date, payment_amount, updated_balance, payment_type,
        payment_method, reference_number, account_name, account_number, bank_name, encoded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        loan.loan_id,
        loan.borrower_id,
        payment_date,
        amount,
        updatedBalance,
        paymentType,
        paymentDetails.paymentMethod,
        paymentDetails.referenceNumber,
        paymentDetails.accountName,
        paymentDetails.accountNumber,
        paymentDetails.bankName,
        req.session.user.user_id
      ]
    );

    await connection.query(
      'UPDATE loans_table SET remaining_balance = ?, loan_status = ? WHERE loan_id = ?',
      [updatedBalance, status, loan.loan_id]
    );

    const [receiptResult] = await connection.query(
      `INSERT INTO receipts_table (payment_id, receipt_date, borrower_id, amount_paid, remarks)
       VALUES (?, ?, ?, ?, ?)`,
      [
        paymentResult.insertId,
        payment_date,
        loan.borrower_id,
        amount,
        buildReceiptRemarks(paymentType, paymentDetails.paymentMethod, paymentDetails.referenceNumber)
      ]
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
            p.updated_balance AS receipt_balance,
            l.total_amount, l.remaining_balance AS current_balance, l.loan_date,
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
      `SELECT p.payment_id, p.loan_id, l.total_amount, l.loan_status, l.due_date
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
    await recalculateLoanLedger(connection, payment);

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
