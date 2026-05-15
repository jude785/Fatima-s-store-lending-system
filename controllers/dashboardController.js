const pool = require('../config/db');

exports.index = async (req, res) => {
  try {
    const [[borrowers]] = await pool.query('SELECT COUNT(*) AS total FROM borrowers_table');
    const [[activeLoans]] = await pool.query("SELECT COUNT(*) AS total FROM loans_table WHERE loan_status IN ('Ongoing','Overdue')");
    const [[overdueLoans]] = await pool.query("SELECT COUNT(*) AS total FROM loans_table WHERE loan_status = 'Overdue'");
    const [[collections]] = await pool.query('SELECT COALESCE(SUM(payment_amount),0) AS total FROM payments_table');
    const [[balances]] = await pool.query('SELECT COALESCE(SUM(remaining_balance),0) AS total FROM loans_table WHERE loan_status IN (\'Ongoing\', \'Overdue\')');

    const [recentLoans] = await pool.query(
      `SELECT l.loan_id, l.loan_date, l.total_amount, l.remaining_balance, l.loan_status,
              CONCAT(b.first_name, ' ', b.last_name) AS borrower_name
       FROM loans_table l
       JOIN borrowers_table b ON b.borrower_id = l.borrower_id
       ORDER BY l.loan_id DESC
       LIMIT 5`
    );

    const [recentPayments] = await pool.query(
      `SELECT p.payment_id, p.payment_date, p.payment_amount, p.updated_balance,
              CONCAT(b.first_name, ' ', b.last_name) AS borrower_name
       FROM payments_table p
       JOIN borrowers_table b ON b.borrower_id = p.borrower_id
       ORDER BY p.payment_id DESC
       LIMIT 5`
    );

    res.render('dashboard/index', {
      title: 'Dashboard',
      stats: {
        borrowers: borrowers.total,
        activeLoans: activeLoans.total,
        overdueLoans: overdueLoans.total,
        collections: collections.total,
        balances: balances.total
      },
      recentLoans,
      recentPayments
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Unable to load dashboard.');
    res.render('dashboard/index', {
      title: 'Dashboard',
      stats: { borrowers: 0, activeLoans: 0, overdueLoans: 0, collections: 0, balances: 0 },
      recentLoans: [],
      recentPayments: []
    });
  }
};
