const pool = require('../config/db');

exports.index = async (req, res) => {
  const [logs] = await pool.query(
    `SELECT a.*, u.username
     FROM audit_logs_table a
     LEFT JOIN users_table u ON u.user_id = a.user_id
     ORDER BY a.audit_id DESC
     LIMIT 200`
  );

  res.render('audit/index', { title: 'Audit Logs', logs });
};
