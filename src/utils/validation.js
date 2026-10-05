const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_RE.test(email.trim());
}

export function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 8;
}

export function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.trim().replace(/[<>]/g, '');
}

export function validateSignupPayload(body) {
  const errors = [];

  const firstName = sanitize(body.firstName);
  const lastName = sanitize(body.lastName);
  const email = sanitize(body.email);
  const phone = sanitize(body.phone);
  const password = body.password || '';
  const confirmPassword = body.confirmPassword || '';

  if (!firstName) errors.push('First name is required.');
  if (!lastName) errors.push('Last name is required.');
  if (!isValidEmail(email)) errors.push('A valid email address is required.');
  if (!phone) errors.push('Phone number is required.');
  if (!isValidPassword(password)) errors.push('Password must be at least 8 characters.');
  if (password !== confirmPassword) errors.push('Passwords do not match.');

  return {
    valid: errors.length === 0,
    errors,
    data: { firstName, lastName, email, phone, password },
  };
}

export function validateLoginPayload(body) {
  const errors = [];
  const email = sanitize(body.email);
  const password = body.password || '';

  if (!isValidEmail(email)) errors.push('A valid email address is required.');
  if (!password) errors.push('Password is required.');

  return {
    valid: errors.length === 0,
    errors,
    data: { email, password },
  };
}
