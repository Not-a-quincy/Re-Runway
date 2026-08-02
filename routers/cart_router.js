import express from 'express';
import pool from '../database/db.js';

const router = express.Router();

// Finds (or creates) the cart that belongs to the current visitor:
// a real cart tied to their user_id if logged in, otherwise a guest
// cart tracked by an id stashed in their session.
async function getOrCreateCart(req) {
  if (req.session.userId) {
    const [rows] = await pool.query('SELECT id FROM carts WHERE user_id = ?', [req.session.userId]);
    if (rows.length) return rows[0].id;

    const [result] = await pool.query('INSERT INTO carts (user_id) VALUES (?)', [req.session.userId]);
    return result.insertId;
  }

  if (req.session.guestCartId) {
    const [rows] = await pool.query('SELECT id FROM carts WHERE id = ?', [req.session.guestCartId]);
    if (rows.length) return rows[0].id;
  }

  const [result] = await pool.query('INSERT INTO carts (session_id) VALUES (?)', [req.sessionID]);
  req.session.guestCartId = result.insertId;
  return result.insertId;
}

async function getCartPayload(cartId) {
  const [rows] = await pool.query(
    `SELECT
       ci.id, ci.size, ci.qty,
       p.id AS product_id, p.brand, p.name, p.price, p.grade, p.stock_qty,
       (SELECT pi.url FROM product_images pi
          WHERE pi.product_id = p.id ORDER BY pi.sort_order ASC LIMIT 1) AS image_url
     FROM cart_items ci
     JOIN products p ON p.id = ci.product_id
     WHERE ci.cart_id = ?
     ORDER BY ci.created_at ASC`,
    [cartId]
  );

  const items = rows.map((r) => ({
    id: r.id,
    productId: r.product_id,
    brand: r.brand,
    name: r.name,
    size: r.size,
    qty: r.qty,
    price: Number(r.price),
    lineTotal: Number(r.price) * r.qty,
    grade: r.grade,
    image: r.image_url || 'https://placehold.co/200x240/eeeeee/1b1b1b?text=IMG',
    inStock: r.stock_qty > 0,
  }));

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

  return {
    items,
    itemCount: items.reduce((sum, item) => sum + item.qty, 0),
    subtotal,
    total: subtotal, // shipping/discounts are flat for now — hook in a promo/shipping engine here later
  };
}

// GET /api/cart
router.get('/', async (req, res) => {
  try {
    const cartId = await getOrCreateCart(req);
    res.json(await getCartPayload(cartId));
  } catch (err) {
    console.error('Error fetching cart:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/cart/items  { productId, size, qty }
router.post('/items', async (req, res) => {
  try {
    const productId = Number(req.body?.productId);
    const size = String(req.body?.size || '').trim();
    const qty = Math.max(1, parseInt(req.body?.qty, 10) || 1);

    if (!productId || !size) {
      return res.status(400).json({ error: 'productId and size are required.' });
    }

    const [sizeRows] = await pool.query(
      'SELECT in_stock FROM product_sizes WHERE product_id = ? AND size = ?',
      [productId, size]
    );
    if (!sizeRows.length) {
      return res.status(404).json({ error: 'That size is not available for this product.' });
    }
    if (!sizeRows[0].in_stock) {
      return res.status(409).json({ error: 'That size is out of stock.' });
    }

    const cartId = await getOrCreateCart(req);

    await pool.query(
      `INSERT INTO cart_items (cart_id, product_id, size, qty)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE qty = qty + VALUES(qty)`,
      [cartId, productId, size, qty]
    );

    res.status(201).json(await getCartPayload(cartId));
  } catch (err) {
    console.error('Error adding item to cart:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/cart/items/:itemId  { qty }
router.patch('/items/:itemId', async (req, res) => {
  try {
    const itemId = Number(req.params.itemId);
    const qty = parseInt(req.body?.qty, 10);

    if (!qty || qty < 1) {
      return res.status(400).json({ error: 'qty must be a positive integer.' });
    }

    const cartId = await getOrCreateCart(req);

    const [result] = await pool.query(
      'UPDATE cart_items SET qty = ? WHERE id = ? AND cart_id = ?',
      [qty, itemId, cartId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Cart item not found.' });
    }

    res.json(await getCartPayload(cartId));
  } catch (err) {
    console.error('Error updating cart item:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/cart/items/:itemId
router.delete('/items/:itemId', async (req, res) => {
  try {
    const itemId = Number(req.params.itemId);
    const cartId = await getOrCreateCart(req);

    await pool.query('DELETE FROM cart_items WHERE id = ? AND cart_id = ?', [itemId, cartId]);

    res.json(await getCartPayload(cartId));
  } catch (err) {
    console.error('Error removing cart item:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
