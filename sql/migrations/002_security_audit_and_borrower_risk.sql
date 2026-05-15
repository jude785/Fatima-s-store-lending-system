ALTER TABLE borrowers_table
  ADD COLUMN risk_status VARCHAR(20) NOT NULL DEFAULT 'Clear' AFTER borrower_status,
  ADD COLUMN warning_note TEXT NULL AFTER risk_status;

UPDATE borrowers_table
SET risk_status = 'Clear'
WHERE risk_status IS NULL OR risk_status = '';

CREATE TABLE IF NOT EXISTS audit_logs_table (
  audit_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id INT NULL,
  details TEXT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_created_at (created_at),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users_table(user_id)
    ON UPDATE CASCADE ON DELETE SET NULL
);
