const pool = require('../config/db');

async function markOverdueLoans(connection = pool) {
  const [result] = await connection.query(
    `UPDATE loans_table
     SET loan_status = 'Overdue'
     WHERE remaining_balance > 0
       AND due_date < CURDATE()
       AND loan_status = 'Ongoing'`
  );

  return result.affectedRows || 0;
}

async function refreshOverdueLoans(req, res, next) {
  if (!req.session?.user) return next();

  try {
    await markOverdueLoans();
  } catch (error) {
    console.error('Unable to refresh overdue loans:', error.message);
  }

  next();
}

module.exports = { markOverdueLoans, refreshOverdueLoans };
