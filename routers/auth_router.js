import express from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import pool, { withTransaction } from '../database/db.js';

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email };
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/auth/signup  { name, email, password }
router.post('/signup', authLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing.length) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await withTransaction(async (conn) => {
      const [result] = await conn.query(
        'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
        [String(name).trim(), normalizedEmail, passwordHash]
      );
      const userId = result.insertId;

      // Give the new user a cart, merging in whatever guest cart they had (if any)
      await mergeGuestCartIntoUser(conn, req.session.guestCartId, userId);

      return { id: userId, name: String(name).trim(), email: normalizedEmail };
    });

    req.session.userId = user.id;
    delete req.session.guestCartId;

    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    console.error('Error signing up:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login  { email, password }
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
    const user = rows[0];

    // Same generic error whether the email or the password was wrong,
    // so we don't leak which emails have accounts.
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    await withTransaction((conn) => mergeGuestCartIntoUser(conn, req.session.guestCartId, user.id));

    req.session.userId = user.id;
    delete req.session.guestCartId;

    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error('Error logging in:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.json({ user: null });
    }
    const [rows] = await pool.query('SELECT id, name, email FROM users WHERE id = ?', [
      req.session.userId,
    ]);
    res.json({ user: rows[0] ? publicUser(rows[0]) : null });
  } catch (err) {
    console.error('Error fetching current user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// If someone was shopping as a guest and then logs in / signs up, fold their
// guest cart items into their real (user-linked) cart instead of losing them.
async function mergeGuestCartIntoUser(conn, guestCartId, userId) {
  if (!guestCartId) return;

  const [[guestCart]] = await conn.query('SELECT id FROM carts WHERE id = ?', [guestCartId]);
  if (!guestCart) return;

  let [[userCart]] = await conn.query('SELECT id FROM carts WHERE user_id = ?', [userId]);
  if (!userCart) {
    const [result] = await conn.query('INSERT INTO carts (user_id) VALUES (?)', [userId]);
    userCart = { id: result.insertId };
  }

  const [guestItems] = await conn.query(
    'SELECT product_id, size, qty FROM cart_items WHERE cart_id = ?',
    [guestCartId]
  );

  for (const item of guestItems) {
    await conn.query(
      `INSERT INTO cart_items (cart_id, product_id, size, qty)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE qty = qty + VALUES(qty)`,
      [userCart.id, item.product_id, item.size, item.qty]
    );
  }

  await conn.query('DELETE FROM carts WHERE id = ?', [guestCartId]);
}

export default router;
