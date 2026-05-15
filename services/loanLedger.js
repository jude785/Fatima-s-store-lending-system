const {
  paymentTypeForBalance,
  resolveLoanStatus,
  roundMoney
} = require('../utils/loanAccounting');

async function recalculateLoanLedger(connection, loan, preferredStatus) {
  const [payments] = await connection.query(
    `SELECT payment_id, payment_amount
     FROM payments_table
     WHERE loan_id = ?
     ORDER BY payment_date ASC, payment_id ASC
     FOR UPDATE`,
    [loan.loan_id]
  );

  let balance = roundMoney(loan.total_amount);

  for (const payment of payments) {
    balance = roundMoney(Math.max(balance - roundMoney(payment.payment_amount), 0));
    await connection.query(
      `UPDATE payments_table
       SET updated_balance = ?, payment_type = ?
       WHERE payment_id = ?`,
      [balance, paymentTypeForBalance(balance), payment.payment_id]
    );
  }

  const status = resolveLoanStatus(balance, loan.due_date, preferredStatus || loan.loan_status);
  await connection.query(
    `UPDATE loans_table
     SET remaining_balance = ?, loan_status = ?
     WHERE loan_id = ?`,
    [balance, status, loan.loan_id]
  );

  return { balance, status };
}

module.exports = { recalculateLoanLedger };
