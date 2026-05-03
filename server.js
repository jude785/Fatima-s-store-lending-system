require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const methodOverride = require('method-override');
const expressLayouts = require('express-ejs-layouts');
const moment = require('moment');

const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const borrowerRoutes = require('./routes/borrowerRoutes');
const loanRoutes = require('./routes/loanRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'fatimas-store-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 }
  })
);

app.use(flash());

app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.currentUser = req.session.user || null;
  res.locals.currentPath = req.path;
  res.locals.moment = moment;
  next();
});

app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  return res.redirect('/login');
});

app.use('/', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/borrowers', borrowerRoutes);
app.use('/loans', loanRoutes);
app.use('/payments', paymentRoutes);
app.use('/reports', reportRoutes);

app.use((req, res) => {
  res.status(404).render('partials/not-found', { title: 'Page Not Found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`FATIMA'S STORE Lending System running on http://localhost:${PORT}`);
});
