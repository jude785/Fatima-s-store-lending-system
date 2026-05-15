ALTER TABLE payments_table
  ADD COLUMN payment_method VARCHAR(30) NOT NULL DEFAULT 'Cash' AFTER payment_type,
  ADD COLUMN reference_number VARCHAR(100) NULL AFTER payment_method,
  ADD COLUMN account_name VARCHAR(100) NULL AFTER reference_number,
  ADD COLUMN account_number VARCHAR(50) NULL AFTER account_name,
  ADD COLUMN bank_name VARCHAR(100) NULL AFTER account_number;

UPDATE payments_table
SET payment_method = 'Cash'
WHERE payment_method IS NULL OR payment_method = '';
