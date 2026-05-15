const pool = require('../config/db');

async function recordAudit(req, action, entityType, entityId = null, details = null) {
  try {
    const userId = req.session?.user?.user_id || null;
    const ipAddress = req.ip || req.socket?.remoteAddress || null;
    const userAgent = req.get ? req.get('user-agent') : null;
    const detailText = details == null ? null : JSON.stringify(details);

    await pool.query(
      `INSERT INTO audit_logs_table
       (user_id, action, entity_type, entity_id, details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, action, entityType, entityId, detailText, ipAddress, userAgent]
    );
  } catch (error) {
    console.error('Audit log failed:', error.message);
    // Log to file for monitoring and debugging
    const fs = require('fs');
    const logEntry = `${new Date().toISOString()} - ${error.message}\n`;
    
    try {
      fs.appendFileSync('/tmp/audit_errors.log', logEntry);
    } catch (fileError) {
      console.error('Failed to write audit error to file:', fileError.message);
    }
    
    // In production, consider sending to external monitoring service
    if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
      // Placeholder for Sentry or similar integration
      console.error('Production audit failure - consider external monitoring');
    }
  }
}

module.exports = { recordAudit };
