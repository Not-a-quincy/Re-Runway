import express from 'express';
import pool from '../database/db.js'; // Adjust relative path to db.js if needed

const router = express.Router();

// GET /api/banners
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM banners');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching banners:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;