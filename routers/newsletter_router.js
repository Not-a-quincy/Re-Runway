import express from 'express';
import pool from '../database/db.js';

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/newsletter  { email }
router.post('/', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();

    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }

    // Insert, ignore duplicates silently so we don't leak subscriber info
    await pool.query(
      'INSERT IGNORE INTO newsletter_subscribers (email) VALUES (?)',
      [email]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('Newsletter signup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
