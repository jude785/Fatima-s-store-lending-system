# FATIMA'S STORE Lending System

A complete school-project web-based lending management system rebuilt using:

- **Frontend:** Bootstrap 5, EJS
- **Backend:** Node.js, Express
- **Database:** MySQL

The system follows the provided case study and Chapter 3 structure: borrower registration, loan management, payment processing, receipt generation, balance tracking, and report generation.

## Features

- User login with session authentication
- Borrower management
- Loan entry, update, and monitoring
- Payment recording with automatic balance updates
- Printable payment receipt
- Daily, weekly, monthly, yearly, collection, and outstanding balance reports
- Database structure aligned with Chapter 3 tables:
  - `users_table`
  - `borrowers_table`
  - `loans_table`
  - `payments_table`
  - `receipts_table`
  - `reports_table`

## Project Structure

```
fatimas-lending-system-node/
  config/
  controllers/
  middleware/
  public/
  routes/
  sql/
  views/
  server.js
  package.json
  .env.example
```

## Setup Instructions

### 1. Install dependencies

```bash
npm install
```

### 2. Create environment file

Copy `.env.example` to `.env` and update the MySQL credentials.

Example:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_NAME=fatimas_lending_system
DB_USER=root
DB_PASSWORD=
SESSION_SECRET=fatimas_store_secret_key
```

### 3. Create the database tables

Run the SQL file in MySQL:

```bash
mysql -u root -p < sql/schema.sql
```

### 4. Seed the default admin account

```bash
npm run seed
```

Default login:

- **Username:** `admin`
- **Password:** `admin123`

### 5. Start the application

```bash
npm run dev
```

or

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

## Notes

- This project is designed as a strong school-project implementation.
- It uses MySQL exactly as requested, so you need a running MySQL server before logging in.
- Receipts and reports are printable from the browser.
- Bootstrap is used for the full UI/UX styling.

## Suggested Next Improvements

- Add borrower delete/archive feature
- Add role-based access control
- Add chart dashboards
- Add PDF export for reports and receipts
- Add audit logs
