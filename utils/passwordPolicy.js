function validatePasswordStrength(password) {
  const value = String(password || '');
  const errors = [];

  if (value.length < 10) errors.push('at least 10 characters');
  if (!/[a-z]/.test(value)) errors.push('one lowercase letter');
  if (!/[A-Z]/.test(value)) errors.push('one uppercase letter');
  if (!/[0-9]/.test(value)) errors.push('one number');
  if (!/[^A-Za-z0-9]/.test(value)) errors.push('one symbol');

  if (errors.length) {
    throw new Error(`Password must contain ${errors.join(', ')}.`);
  }
}

module.exports = { validatePasswordStrength };
