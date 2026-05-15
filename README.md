# FATIMA'S STORE Lending System

A web-based lending management system built with Node.js, Express, Bootstrap, EJS, and MySQL.

## Features

- User login with session authentication
- Borrower management
- Loan entry, update, and monitoring
- Payment recording with automatic balance updates
- Cash, GCash, and bank account payment tracking
- Printable payment receipts
- Lending and collection reports

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env` and update your MySQL credentials.

3. Create the database tables:

```bash
mysql -u root -p < sql/schema.sql
```

4. Run migrations for existing databases:

```bash
npm run migrate
```

5. Seed the default admin account:

```bash
npm run seed
```

Default login:

- Username: `admin`
- Password: `admin123`

6. Start the application:

```bash
npm start
```

Then open `http://localhost:3000`.
