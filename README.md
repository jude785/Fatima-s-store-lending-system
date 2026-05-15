# FATIMA'S STORE Lending System

A Node.js, Express, EJS, Bootstrap, and MySQL lending management system for borrower records, loan monitoring, payments, receipts, reporting, and staff access control.

## Security And Commercial Features

- Session login with secure cookie settings
- CSRF protection for mutating forms
- Login attempt rate limiting
- Administrator and Staff roles
- Admin-only user management
- Strong password validation for created/reset users
- Audit logs for security and transaction events
- Borrower risk flags: Clear, Warning, Blacklisted
- Automated overdue loan marking
- Cash, GCash, and bank account payment tracking
- CSV export for collection reports
- Demo data seed script for presentations

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env` and configure real values:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_NAME=fatimas_lending_system
DB_USER=root
DB_PASSWORD=
SESSION_SECRET=replace_with_a_long_random_session_secret
ADMIN_PASSWORD=UseAStrongAdminPassword123!
```

3. Create the database:

```bash
mysql -u root -p < sql/schema.sql
```

4. Apply migrations for existing databases:

```bash
npm run migrate
```

5. Seed the administrator account:

```bash
npm run seed
```

The admin password comes from `ADMIN_PASSWORD` in `.env`; do not commit real credentials.

6. Optional demo data for buyer presentations:

```bash
npm run seed:demo
```

7. Start the app:

```bash
npm start
```

Open `http://localhost:3000`.

## Verification

Run the smoke checks before demos or deployment:

```bash
npm run check
```

## Deployment Notes

- Use a long random `SESSION_SECRET` in production.
- Set `NODE_ENV=production` behind HTTPS so secure cookies are enabled.
- Keep `.env` out of version control.
- Run `npm run migrate` before starting a deployed build.
- Create individual staff accounts instead of sharing one administrator login.
