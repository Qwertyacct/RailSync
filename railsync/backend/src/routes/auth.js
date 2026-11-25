const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const db = require('../config/db');
const validate = require('../middleware/validate');

router.post('/register', [
  body('full_name').trim().isLength({ min: 2, max: 100 }).withMessage('Enter your full name.'),
  body('email').isEmail().normalizeEmail(),
  body('phone').matches(/^[0-9]{10}$/).withMessage('Enter a 10-digit phone number.'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
], validate, async (req, res) => {
  const { full_name, email, phone, password } = req.body;
  const password_hash = await bcrypt.hash(password, 12);
  try {
    const [result] = await db.execute(
      'INSERT INTO users (full_name, email, phone, password_hash) VALUES (?, ?, ?, ?)',
      [full_name, email, phone, password_hash]
    );
    res.status(201).json({ message: 'Account created.', user_id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Email or phone is already registered.' });
    throw err;
  }
});

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], validate, async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await db.execute(
    'SELECT user_id, full_name, email, role, password_hash FROM users WHERE email = ? LIMIT 1',
    [email]
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }
  const payload = { user_id: user.user_id, full_name: user.full_name, email: user.email, role: user.role };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, user: payload });
});

module.exports = router;
