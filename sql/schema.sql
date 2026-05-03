CREATE DATABASE IF NOT EXISTS fatimas_lending_system;
USE fatimas_lending_system;

CREATE TABLE IF NOT EXISTS users_table (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'Administrator',
  status BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS borrowers_table (
  borrower_id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL,
  middle_name VARCHAR(50) NULL,
  last_name VARCHAR(50) NOT NULL,
  address VARCHAR(150) NOT NULL,
  contact_number VARCHAR(20) NOT NULL,
  borrower_status VARCHAR(20) NOT NULL DEFAULT 'Active',
  date_registered DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS loans_table (
  loan_id INT AUTO_INCREMENT PRIMARY KEY,
  borrower_id INT NOT NULL,
  loan_date DATE NOT NULL,
  due_date DATE NOT NULL,
  principal_amount DECIMAL(10,2) NOT NULL,
  interest_amount DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  remaining_balance DECIMAL(10,2) NOT NULL,
  loan_status VARCHAR(20) NOT NULL DEFAULT 'Ongoing',
  CONSTRAINT fk_loans_borrower FOREIGN KEY (borrower_id) REFERENCES borrowers_table(borrower_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS payments_table (
  payment_id INT AUTO_INCREMENT PRIMARY KEY,
  loan_id INT NOT NULL,
  borrower_id INT NOT NULL,
  payment_date DATE NOT NULL,
  payment_amount DECIMAL(10,2) NOT NULL,
  updated_balance DECIMAL(10,2) NOT NULL,
  payment_type VARCHAR(30) NOT NULL,
  encoded_by INT NOT NULL,
  CONSTRAINT fk_payments_loan FOREIGN KEY (loan_id) REFERENCES loans_table(loan_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_payments_borrower FOREIGN KEY (borrower_id) REFERENCES borrowers_table(borrower_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_payments_user FOREIGN KEY (encoded_by) REFERENCES users_table(user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS receipts_table (
  receipt_id INT AUTO_INCREMENT PRIMARY KEY,
  payment_id INT NOT NULL,
  receipt_date DATE NOT NULL,
  borrower_id INT NOT NULL,
  amount_paid DECIMAL(10,2) NOT NULL,
  remarks VARCHAR(100) NULL,
  CONSTRAINT fk_receipts_payment FOREIGN KEY (payment_id) REFERENCES payments_table(payment_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_receipts_borrower FOREIGN KEY (borrower_id) REFERENCES borrowers_table(borrower_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS reports_table (
  report_id INT AUTO_INCREMENT PRIMARY KEY,
  report_type VARCHAR(30) NOT NULL,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  total_loans DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_collections DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_outstanding DECIMAL(10,2) NOT NULL DEFAULT 0,
  generated_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reports_user FOREIGN KEY (generated_by) REFERENCES users_table(user_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);
