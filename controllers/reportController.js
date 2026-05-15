const pool = require('../config/db');
const { isDateRangeValid } = require('../utils/loanAccounting');

async function saveReport(reportType, dateFrom, dateTo, totals, generatedBy) {
  await pool.query(
    `INSERT INTO reports_table
     (report_type, date_from, date_to, total_loans, total_collections, total_outstanding, generated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [reportType, dateFrom, dateTo, totals.totalLoans, totals.totalCollections, totals.totalOutstanding, generatedBy]
  );
}

function todayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getReportFilters(query) {
  const reportType = query.report_type || 'Daily';
  const dateFrom = query.date_from || todayInputValue();
  const dateTo = query.date_to || todayInputValue();

  if (!isDateRangeValid(dateFrom, dateTo)) {
    throw new Error('Report date range is invalid.');
  }

  return { reportType, dateFrom, dateTo };
}

exports.index = async (req, res) => {
  let filters;
  try {
    filters = getReportFilters(req.query);

    const [[loanTotals]] = await pool.query(
      `SELECT COALESCE(SUM(total_amount),0) AS totalLoans
       FROM loans_table WHERE loan_date BETWEEN ? AND ?`,
      [filters.dateFrom, filters.dateTo]
    );

    const [[collectionTotals]] = await pool.query(
      `SELECT COALESCE(SUM(payment_amount),0) AS totalCollections
       FROM payments_table WHERE payment_date BETWEEN ? AND ?`,
      [filters.dateFrom, filters.dateTo]
    );

    const [[outstandingTotals]] = await pool.query(
      `SELECT COALESCE(SUM(remaining_balance),0) AS totalOutstanding
       FROM loans_table WHERE loan_date <= ? AND loan_status IN ('Ongoing','Overdue')`,
      [filters.dateTo]
    );

    const [loanRows] = await pool.query(
      `SELECT l.loan_id, l.loan_date, l.total_amount, l.remaining_balance, l.loan_status,
              CONCAT(b.first_name, ' ', b.last_name) AS borrower_name
       FROM loans_table l
       JOIN borrowers_table b ON b.borrower_id = l.borrower_id
       WHERE l.loan_date BETWEEN ? AND ?
       ORDER BY l.loan_date DESC, l.loan_id DESC`,
      [filters.dateFrom, filters.dateTo]
    );

    const [paymentRows] = await pool.query(
      `SELECT p.*,
              CONCAT(b.first_name, ' ', b.last_name) AS borrower_name
       FROM payments_table p
       JOIN borrowers_table b ON b.borrower_id = p.borrower_id
       WHERE p.payment_date BETWEEN ? AND ?
       ORDER BY p.payment_date DESC, p.payment_id DESC`,
      [filters.dateFrom, filters.dateTo]
    );

    return res.render('reports/index', {
      title: 'Reports',
      filters,
      totals: {
        totalLoans: loanTotals.totalLoans,
        totalCollections: collectionTotals.totalCollections,
        totalOutstanding: outstandingTotals.totalOutstanding
      },
      loanRows,
      paymentRows
    });
  } catch (error) {
    console.error(error);
    req.flash('error', error.message || 'Unable to load reports.');
    filters = filters || { reportType: 'Daily', dateFrom: todayInputValue(), dateTo: todayInputValue() };
    return res.render('reports/index', {
      title: 'Reports',
      filters,
      totals: { totalLoans: 0, totalCollections: 0, totalOutstanding: 0 },
      loanRows: [],
      paymentRows: []
    });
  }
};

exports.storeSummary = async (req, res) => {
  try {
    const { report_type, date_from, date_to, total_loans, total_collections, total_outstanding } = req.body;
    if (!isDateRangeValid(date_from, date_to)) {
      throw new Error('Report date range is invalid.');
    }

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
    return res.redirect(`/reports?report_type=${encodeURIComponent(report_type)}&date_from=${date_from}&date_to=${date_to}`);
  } catch (error) {
    console.error(error);
    req.flash('error', error.message || 'Unable to save report summary.');
    return res.redirect('/reports');
  }
};
