const pool = require('../config/db');
const { recordAudit } = require('../services/auditLogger');

const BORROWER_STATUSES = ['Active', 'Inactive'];
const RISK_STATUSES = ['Clear', 'Warning', 'Blacklisted'];

function cleanRequired(value, label) {
  const text = String(value || '').trim();
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

function cleanOptional(value) {
  const text = String(value || '').trim();
  return text || null;
}

function validateBorrowerPayload(body) {
  const borrowerStatus = cleanRequired(body.borrower_status, 'Borrower status');
  if (!BORROWER_STATUSES.includes(borrowerStatus)) {
    throw new Error('Invalid borrower status selected.');
  }

  const riskStatus = cleanRequired(body.risk_status || 'Clear', 'Risk status');
  if (!RISK_STATUSES.includes(riskStatus)) {
    throw new Error('Invalid borrower risk status selected.');
  }

  return {
    firstName: cleanRequired(body.first_name, 'First name'),
    middleName: cleanOptional(body.middle_name),
    lastName: cleanRequired(body.last_name, 'Last name'),
    address: cleanRequired(body.address, 'Address'),
    contactNumber: cleanRequired(body.contact_number, 'Contact number'),
    borrowerStatus,
    riskStatus,
    warningNote: cleanOptional(body.warning_note)
  };
}

exports.index = async (req, res) => {
  const keyword = req.query.keyword || '';
  const sql = `SELECT * FROM borrowers_table
               WHERE first_name LIKE ?
                  OR middle_name LIKE ?
                  OR last_name LIKE ?
                  OR contact_number LIKE ?
               ORDER BY borrower_id DESC`;
  const like = `%${keyword}%`;
  const [borrowers] = await pool.query(sql, [like, like, like, like]);
  res.render('borrowers/index', { title: 'Borrowers', borrowers, keyword });
};

exports.createForm = (req, res) => {
  res.render('borrowers/create', { title: 'Add Borrower' });
};

exports.store = async (req, res) => {
  try {
    const borrower = validateBorrowerPayload(req.body);
    const [result] = await pool.query(
      `INSERT INTO borrowers_table
       (first_name, middle_name, last_name, address, contact_number, borrower_status, risk_status, warning_note, date_registered)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE())`,
      [
        borrower.firstName,
        borrower.middleName,
        borrower.lastName,
        borrower.address,
        borrower.contactNumber,
        borrower.borrowerStatus,
        borrower.riskStatus,
        borrower.warningNote
      ]
    );
    await recordAudit(req, 'BORROWER_CREATED', 'borrower', result.insertId, {
      name: `${borrower.firstName} ${borrower.lastName}`,
      riskStatus: borrower.riskStatus
    });
    req.flash('success', 'Borrower added successfully.');
    return res.redirect('/borrowers');
  } catch (error) {
    console.error(error);
    req.flash('error', error.message || 'Unable to add borrower.');
    return res.redirect('/borrowers/create');
  }
};

exports.editForm = async (req, res) => {
  const [[borrower]] = await pool.query('SELECT * FROM borrowers_table WHERE borrower_id = ?', [req.params.id]);
  if (!borrower) {
    req.flash('error', 'Borrower not found.');
    return res.redirect('/borrowers');
  }
  res.render('borrowers/edit', { title: 'Edit Borrower', borrower });
};

exports.update = async (req, res) => {
  try {
    const borrower = validateBorrowerPayload(req.body);
    const [result] = await pool.query(
      `UPDATE borrowers_table
       SET first_name = ?, middle_name = ?, last_name = ?, address = ?, contact_number = ?,
           borrower_status = ?, risk_status = ?, warning_note = ?
       WHERE borrower_id = ?`,
      [
        borrower.firstName,
        borrower.middleName,
        borrower.lastName,
        borrower.address,
        borrower.contactNumber,
        borrower.borrowerStatus,
        borrower.riskStatus,
        borrower.warningNote,
        req.params.id
      ]
    );

    if (!result.affectedRows) {
      req.flash('error', 'Borrower not found.');
      return res.redirect('/borrowers');
    }

    await recordAudit(req, 'BORROWER_UPDATED', 'borrower', req.params.id, {
      riskStatus: borrower.riskStatus
    });
    req.flash('success', 'Borrower updated successfully.');
    return res.redirect('/borrowers');
  } catch (error) {
    console.error(error);
    req.flash('error', error.message || 'Unable to update borrower.');
    return res.redirect(`/borrowers/${req.params.id}/edit`);
  }
};

exports.show = async (req, res) => {
  const [[borrower]] = await pool.query('SELECT * FROM borrowers_table WHERE borrower_id = ?', [req.params.id]);
  if (!borrower) {
    req.flash('error', 'Borrower not found.');
    return res.redirect('/borrowers');
  }

  const [loans] = await pool.query('SELECT * FROM loans_table WHERE borrower_id = ? ORDER BY loan_id DESC', [req.params.id]);
  const [payments] = await pool.query('SELECT * FROM payments_table WHERE borrower_id = ? ORDER BY payment_id DESC LIMIT 10', [req.params.id]);

  res.render('borrowers/show', { title: 'Borrower Details', borrower, loans, payments });
};

exports.destroy = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [[borrower]] = await connection.query(
      'SELECT borrower_id FROM borrowers_table WHERE borrower_id = ? FOR UPDATE',
      [req.params.id]
    );

    if (!borrower) {
      await connection.rollback();
      req.flash('error', 'Borrower not found.');
      return res.redirect('/borrowers');
    }

    await connection.query(
      `DELETE r FROM receipts_table r
       JOIN payments_table p ON p.payment_id = r.payment_id
       JOIN loans_table l ON l.loan_id = p.loan_id
       WHERE l.borrower_id = ?`,
      [req.params.id]
    );
    await connection.query(
      `DELETE p FROM payments_table p
       JOIN loans_table l ON l.loan_id = p.loan_id
       WHERE l.borrower_id = ?`,
      [req.params.id]
    );
    await connection.query('DELETE FROM loans_table WHERE borrower_id = ?', [req.params.id]);
    await connection.query('DELETE FROM borrowers_table WHERE borrower_id = ?', [req.params.id]);

    await connection.commit();
    await recordAudit(req, 'BORROWER_DELETED', 'borrower', req.params.id);
    req.flash('success', 'Borrower and related records deleted successfully.');
    return res.redirect('/borrowers');
  } catch (error) {
    await connection.rollback();
    console.error(error);
    req.flash('error', 'Unable to delete borrower record.');
    return res.redirect('/borrowers');
  } finally {
    connection.release();
  }
};
