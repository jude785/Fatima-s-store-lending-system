function roundMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return NaN;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function parseDateOnly(value) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const dateText = String(value).slice(0, 10);
  const parts = dateText.split('-').map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) {
    return null;
  }

  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
}

function isDateRangeValid(dateFrom, dateTo) {
  const start = parseDateOnly(dateFrom);
  const end = parseDateOnly(dateTo);
  return Boolean(start && end && start <= end);
}

function isPastDue(dueDate) {
  const due = parseDateOnly(dueDate);
  if (!due) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

function resolveLoanStatus(balance, dueDate, preferredStatus) {
  const roundedBalance = roundMoney(balance);
  if (!Number.isFinite(roundedBalance) || roundedBalance <= 0) return 'Paid';
  if (preferredStatus === 'Overdue' || isPastDue(dueDate)) return 'Overdue';
  return 'Ongoing';
}

function paymentTypeForBalance(balance) {
  return roundMoney(balance) <= 0 ? 'Full' : 'Partial';
}

module.exports = {
  isDateRangeValid,
  parseDateOnly,
  paymentTypeForBalance,
  resolveLoanStatus,
  roundMoney
};
