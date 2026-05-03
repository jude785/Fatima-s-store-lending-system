const pool = require('../config/db');

async function saveReport(reportType, dateFrom, dateTo, totals, generatedBy) {
  await pool.query(
    `INSERT INTO reports_table
     (report_type, date_from, date_to, total_loans, total_collections, total_outstanding, generated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [reportType, dateFrom, dateTo, totals.totalLoans, totals.totalCollections, totals.totalOutstanding, generatedBy]
  );
}

exports.index = async (req, res) => {
  const reportType = req.query.report_type || 'Daily';
  const dateFrom = req.query.date_from || new Date().toISOString().slice(0, 10);
  const dateTo = req.query.date_to || new Date().toISOString().slice(0, 10);

  const [[loanTotals]] = await pool.query(
    `SELECT COALESCE(SUM(total_amount),0) AS totalLoans
     FROM loans_table WHERE loan_date BETWEEN ? AND ?`,
    [dateFrom, dateTo]
  );

  const [[collectionTotals]] = await pool.query(
    `SELECT COALESCE(SUM(payment_amount),0) AS totalCollections
     FROM payments_table WHERE payment_date BETWEEN ? AND ?`,
    [dateFrom, dateTo]
  );

  const [[outstandingTotals]] = await pool.query(
    `SELECT COALESCE(SUM(remaining_balance),0) AS totalOutstanding
     FROM loans_table WHERE loan_date <= ? AND loan_status IN ('Ongoing','Overdue')`,
    [dateTo]
  );

  const [loanRows] = await pool.query(
    `SELECT l.loan_id, l.loan_date, l.total_amount, l.remaining_balance, l.loan_status,
            CONCAT(b.first_name, ' ', b.last_name) AS borrower_name
     FROM loans_table l
     JOIN borrowers_table b ON b.borrower_id = l.borrower_id
     WHERE l.loan_date BETWEEN ? AND ?
     ORDER BY l.loan_date DESC`,
    [dateFrom, dateTo]
  );

  const [paymentRows] = await pool.query(
    `SELECT p.payment_id, p.payment_date, p.payment_amount, p.updated_balance,
            CONCAT(b.first_name, ' ', b.last_name) AS borrower_name
     FROM payments_table p
     JOIN borrowers_table b ON b.borrower_id = p.borrower_id
     WHERE p.payment_date BETWEEN ? AND ?
     ORDER BY p.payment_date DESC`,
    [dateFrom, dateTo]
  );

  res.render('reports/index', {
    title: 'Reports',
    filters: { reportType, dateFrom, dateTo },
    totals: {
      totalLoans: loanTotals.totalLoans,
      totalCollections: collectionTotals.totalCollections,
      totalOutstanding: outstandingTotals.totalOutstanding
    },
    loanRows,
    paymentRows
  });
};

exports.storeSummary = async (req, res) => {
  const { report_type, date_from, date_to, total_loans, total_collections, total_outstanding } = req.body;
  await saveReport(
    report_type,
    date_from,
    date_to,
    {
      totalLoans: total_loans,
      totalCollections: total_collections,
      totalOutstanding: total_outstanding
    },
    req.session.user.user_id
  );
  req.flash('success', 'Report summary saved to database.');
  res.redirect(`/reports?report_type=${encodeURIComponent(report_type)}&date_from=${date_from}&date_to=${date_to}`);
};
