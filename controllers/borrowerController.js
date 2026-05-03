const pool = require('../config/db');

exports.index = async (req, res) => {
  const keyword = req.query.keyword || '';
  const sql = `SELECT * FROM borrowers_table
               WHERE first_name LIKE ? OR last_name LIKE ? OR contact_number LIKE ?
               ORDER BY borrower_id DESC`;
  const like = `%${keyword}%`;
  const [borrowers] = await pool.query(sql, [like, like, like]);
  res.render('borrowers/index', { title: 'Borrowers', borrowers, keyword });
};

exports.createForm = (req, res) => {
  res.render('borrowers/create', { title: 'Add Borrower' });
};

exports.store = async (req, res) => {
  const { first_name, middle_name, last_name, address, contact_number, borrower_status } = req.body;
  await pool.query(
    `INSERT INTO borrowers_table
     (first_name, middle_name, last_name, address, contact_number, borrower_status, date_registered)
     VALUES (?, ?, ?, ?, ?, ?, CURDATE())`,
    [first_name, middle_name, last_name, address, contact_number, borrower_status]
  );
  req.flash('success', 'Borrower added successfully.');
  res.redirect('/borrowers');
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
  const { first_name, middle_name, last_name, address, contact_number, borrower_status } = req.body;
  await pool.query(
    `UPDATE borrowers_table
     SET first_name = ?, middle_name = ?, last_name = ?, address = ?, contact_number = ?, borrower_status = ?
     WHERE borrower_id = ?`,
    [first_name, middle_name, last_name, address, contact_number, borrower_status, req.params.id]
  );
  req.flash('success', 'Borrower updated successfully.');
  res.redirect('/borrowers');
};

exports.show = async (req, res) => {
  const [[borrower]] = await pool.query('SELECT * FROM borrowers_table WHERE borrower_id = ?', [req.params.id]);
  const [loans] = await pool.query('SELECT * FROM loans_table WHERE borrower_id = ? ORDER BY loan_id DESC', [req.params.id]);
  const [payments] = await pool.query('SELECT * FROM payments_table WHERE borrower_id = ? ORDER BY payment_id DESC LIMIT 10', [req.params.id]);
  if (!borrower) {
    req.flash('error', 'Borrower not found.');
    return res.redirect('/borrowers');
  }
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

    await connection.query('DELETE FROM receipts_table WHERE borrower_id = ?', [req.params.id]);
    await connection.query('DELETE FROM payments_table WHERE borrower_id = ?', [req.params.id]);
    await connection.query('DELETE FROM loans_table WHERE borrower_id = ?', [req.params.id]);
    await connection.query('DELETE FROM borrowers_table WHERE borrower_id = ?', [req.params.id]);

    await connection.commit();
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
