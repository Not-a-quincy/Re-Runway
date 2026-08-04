import express from 'express';
import pool from '../database/db.js';

const router = express.Router();

const CATEGORIES = ['Outerwear', 'Denim', 'Knitwear', 'Footwear', 'Accessories'];
const GRADES = ['S', 'A', 'B', 'C'];
const AUDIENCES = ['Men', 'Women', 'Unisex'];

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function uniqueSlug(base, excludeId) {
  let slug = slugify(base) || 'product';
  let suffix = 1;
  // Keep trying until we find a slug that isn't taken by a *different* product.
  while (true) {
    const [rows] = await pool.query(
      `SELECT id FROM products WHERE slug = ? ${excludeId ? 'AND id != ?' : ''}`,
      excludeId ? [slug, excludeId] : [slug]
    );
    if (!rows.length) return slug;
    suffix += 1;
    slug = `${slugify(base)}-${suffix}`;
  }
}

async function uniqueCreatorSlug(base, excludeId) {
  let slug = slugify(base) || 'creator';
  let suffix = 1;
  while (true) {
    const [rows] = await pool.query(
      `SELECT id FROM creators WHERE slug = ? ${excludeId ? 'AND id != ?' : ''}`,
      excludeId ? [slug, excludeId] : [slug]
    );
    if (!rows.length) return slug;
    suffix += 1;
    slug = `${slugify(base)}-${suffix}`;
  }
}

// ---------------------------------------------------------------------------
// DASHBOARD
// ---------------------------------------------------------------------------

router.get('/stats', async (req, res) => {
  try {
    const [[{ totalProducts }]] = await pool.query('SELECT COUNT(*) AS totalProducts FROM products');
    const [[{ totalUsers }]] = await pool.query('SELECT COUNT(*) AS totalUsers FROM users');
    const [[{ totalBanners }]] = await pool.query('SELECT COUNT(*) AS totalBanners FROM banners');
    const [[{ outOfStock }]] = await pool.query(
      'SELECT COUNT(*) AS outOfStock FROM products WHERE stock_qty = 0'
    );
    const [[{ lowStock }]] = await pool.query(
      'SELECT COUNT(*) AS lowStock FROM products WHERE stock_qty > 0 AND stock_qty <= 2'
    );
    const [[{ cartsWithItems }]] = await pool.query(
      'SELECT COUNT(DISTINCT cart_id) AS cartsWithItems FROM cart_items'
    );

    const [recentProducts] = await pool.query(
      'SELECT id, brand, name, price, stock_qty, created_at FROM products ORDER BY created_at DESC LIMIT 5'
    );
    const [recentUsers] = await pool.query(
      'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 5'
    );

    res.json({
      totalProducts,
      totalUsers,
      totalBanners,
      outOfStock,
      lowStock,
      cartsWithItems,
      recentProducts,
      recentUsers,
    });
  } catch (err) {
    console.error('Error loading admin stats:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PRODUCTS
// ---------------------------------------------------------------------------

router.get('/products', async (req, res) => {
  try {
    const search = req.query.q ? String(req.query.q).trim() : '';
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;

    const where = [];
    const params = [];
    if (search) {
      where.push('(p.name LIKE ? OR p.brand LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM products p ${whereSql}`, params);
    const [rows] = await pool.query(
      `SELECT p.*, c.name AS creator_name, (
         SELECT pi.url FROM product_images pi
         WHERE pi.product_id = p.id ORDER BY pi.sort_order ASC LIMIT 1
       ) AS image_url
       FROM products p
       LEFT JOIN creators c ON c.id = p.creator_id
       ${whereSql} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    res.json({ items: rows, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (err) {
    console.error('Error listing products (admin):', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/products/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Product not found' });

    const [images] = await pool.query(
      'SELECT id, url, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order ASC',
      [req.params.id]
    );
    const [sizes] = await pool.query(
      'SELECT id, size, in_stock FROM product_sizes WHERE product_id = ? ORDER BY id ASC',
      [req.params.id]
    );

    res.json({ ...rows[0], images, sizes });
  } catch (err) {
    console.error('Error loading product (admin):', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function validateProductBody(body) {
  const errors = [];
  if (!body.brand || !String(body.brand).trim()) errors.push('Brand is required.');
  if (!body.name || !String(body.name).trim()) errors.push('Name is required.');
  if (!CATEGORIES.includes(body.category)) errors.push('Category must be one of: ' + CATEGORIES.join(', '));
  if (!GRADES.includes(body.grade)) errors.push('Grade must be one of: ' + GRADES.join(', '));
  if (!AUDIENCES.includes(body.audience)) errors.push('Audience must be one of: ' + AUDIENCES.join(', '));
  if (body.price == null || isNaN(Number(body.price)) || Number(body.price) < 0) errors.push('Price must be a positive number.');
  if (body.originalPrice != null && body.originalPrice !== '' && (isNaN(Number(body.originalPrice)) || Number(body.originalPrice) < 0)) {
    errors.push('Original price must be a positive number.');
  }
  if (body.creatorId != null && body.creatorId !== '' && isNaN(Number(body.creatorId))) {
    errors.push('Creator is invalid.');
  }
  return errors;
}

router.post('/products', async (req, res) => {
  try {
    const errors = validateProductBody(req.body || {});
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });

    const { brand, name, category, audience, price, originalPrice, grade, verified, conditionNotes, materialCare, sellerNotes, stockQty, creatorId } = req.body;

    const slug = await uniqueSlug(`${brand}-${name}`);

    const [result] = await pool.query(
      `INSERT INTO products
        (brand, name, slug, category, audience, price, original_price, grade, verified, condition_notes, material_care, seller_notes, stock_qty, creator_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(brand).trim(),
        String(name).trim(),
        slug,
        category,
        audience,
        Number(price),
        originalPrice ? Number(originalPrice) : null,
        grade,
        !!verified,
        conditionNotes || null,
        materialCare || null,
        sellerNotes || null,
        Math.max(0, parseInt(stockQty, 10) || 0),
        creatorId ? Number(creatorId) : null,
      ]
    );

    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/products/:id', async (req, res) => {
  try {
    const errors = validateProductBody(req.body || {});
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });

    const [existingRows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!existingRows.length) return res.status(404).json({ error: 'Product not found' });
    const existing = existingRows[0];

    const { brand, name, category, audience, price, originalPrice, grade, verified, conditionNotes, materialCare, sellerNotes, stockQty, creatorId } = req.body;

    let slug = existing.slug;
    if (brand !== existing.brand || name !== existing.name) {
      slug = await uniqueSlug(`${brand}-${name}`, req.params.id);
    }

    await pool.query(
      `UPDATE products SET
         brand = ?, name = ?, slug = ?, category = ?, audience = ?, price = ?, original_price = ?,
         grade = ?, verified = ?, condition_notes = ?, material_care = ?,
         seller_notes = ?, stock_qty = ?, creator_id = ?
       WHERE id = ?`,
      [
        String(brand).trim(),
        String(name).trim(),
        slug,
        category,
        audience,
        Number(price),
        originalPrice ? Number(originalPrice) : null,
        grade,
        !!verified,
        conditionNotes || null,
        materialCare || null,
        sellerNotes || null,
        Math.max(0, parseInt(stockQty, 10) || 0),
        creatorId ? Number(creatorId) : null,
        req.params.id,
      ]
    );

    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Quick inline stock update (used by the dashboard's stock quick-edit)
router.patch('/products/:id/stock', async (req, res) => {
  try {
    const stockQty = parseInt(req.body?.stockQty, 10);
    if (isNaN(stockQty) || stockQty < 0) {
      return res.status(400).json({ error: 'stockQty must be a non-negative integer.' });
    }
    const [result] = await pool.query('UPDATE products SET stock_qty = ? WHERE id = ?', [stockQty, req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ id: Number(req.params.id), stockQty });
  } catch (err) {
    console.error('Error updating stock:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/products/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Product images ---
router.post('/products/:id/images', async (req, res) => {
  try {
    const url = String(req.body?.url || '').trim();
    if (!url) return res.status(400).json({ error: 'Image url is required.' });

    const [[{ nextOrder }]] = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS nextOrder FROM product_images WHERE product_id = ?',
      [req.params.id]
    );
    const [result] = await pool.query(
      'INSERT INTO product_images (product_id, url, sort_order) VALUES (?, ?, ?)',
      [req.params.id, url, nextOrder]
    );
    res.status(201).json({ id: result.insertId, url, sortOrder: nextOrder });
  } catch (err) {
    console.error('Error adding product image:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/products/:id/images/:imageId', async (req, res) => {
  try {
    await pool.query('DELETE FROM product_images WHERE id = ? AND product_id = ?', [
      req.params.imageId,
      req.params.id,
    ]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting product image:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Product sizes ---
router.post('/products/:id/sizes', async (req, res) => {
  try {
    const size = String(req.body?.size || '').trim();
    const inStock = req.body?.inStock !== false;
    if (!size) return res.status(400).json({ error: 'Size is required.' });

    await pool.query(
      `INSERT INTO product_sizes (product_id, size, in_stock) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE in_stock = VALUES(in_stock)`,
      [req.params.id, size, inStock]
    );

    const [rows] = await pool.query('SELECT id, size, in_stock FROM product_sizes WHERE product_id = ? ORDER BY id ASC', [req.params.id]);
    res.status(201).json(rows);
  } catch (err) {
    console.error('Error adding product size:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/products/:id/sizes/:sizeId', async (req, res) => {
  try {
    const inStock = !!req.body?.inStock;
    await pool.query('UPDATE product_sizes SET in_stock = ? WHERE id = ? AND product_id = ?', [
      inStock,
      req.params.sizeId,
      req.params.id,
    ]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error updating product size:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/products/:id/sizes/:sizeId', async (req, res) => {
  try {
    await pool.query('DELETE FROM product_sizes WHERE id = ? AND product_id = ?', [
      req.params.sizeId,
      req.params.id,
    ]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting product size:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// CREATORS (individual sellers/creators onboarded without a merchant account —
// products are attributed to them and their info surfaces on the PDP)
// ---------------------------------------------------------------------------

router.get('/creators', async (req, res) => {
  try {
    const search = req.query.q ? String(req.query.q).trim() : '';
    const where = search ? 'WHERE c.name LIKE ?' : '';
    const params = search ? [`%${search}%`] : [];

    const [rows] = await pool.query(
      `SELECT c.*, (
         SELECT COUNT(*) FROM products p WHERE p.creator_id = c.id
       ) AS product_count
       FROM creators c ${where} ORDER BY c.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('Error listing creators:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/creators/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM creators WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Creator not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error loading creator:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function validateCreatorBody(body) {
  const errors = [];
  if (!body.name || !String(body.name).trim()) errors.push('Name is required.');
  return errors;
}

router.post('/creators', async (req, res) => {
  try {
    const errors = validateCreatorBody(req.body || {});
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });

    const { name, bio, photoUrl, instagramHandle, contactNumber, city, verified } = req.body;
    const slug = await uniqueCreatorSlug(name);

    const [result] = await pool.query(
      `INSERT INTO creators (name, slug, bio, photo_url, instagram_handle, contact_number, city, verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(name).trim(),
        slug,
        bio || null,
        photoUrl || null,
        instagramHandle || null,
        contactNumber || null,
        city || null,
        verified !== false,
      ]
    );

    const [rows] = await pool.query('SELECT * FROM creators WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error creating creator:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/creators/:id', async (req, res) => {
  try {
    const errors = validateCreatorBody(req.body || {});
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });

    const [existingRows] = await pool.query('SELECT * FROM creators WHERE id = ?', [req.params.id]);
    if (!existingRows.length) return res.status(404).json({ error: 'Creator not found' });
    const existing = existingRows[0];

    const { name, bio, photoUrl, instagramHandle, contactNumber, city, verified } = req.body;

    let slug = existing.slug;
    if (name !== existing.name) {
      slug = await uniqueCreatorSlug(name, req.params.id);
    }

    await pool.query(
      `UPDATE creators SET
         name = ?, slug = ?, bio = ?, photo_url = ?, instagram_handle = ?,
         contact_number = ?, city = ?, verified = ?
       WHERE id = ?`,
      [
        String(name).trim(),
        slug,
        bio || null,
        photoUrl || null,
        instagramHandle || null,
        contactNumber || null,
        city || null,
        verified !== false,
        req.params.id,
      ]
    );

    const [rows] = await pool.query('SELECT * FROM creators WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating creator:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/creators/:id', async (req, res) => {
  try {
    // Products stay listed — their creator_id just falls back to NULL (ON DELETE SET NULL).
    const [result] = await pool.query('DELETE FROM creators WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Creator not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting creator:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// BANNERS
// ---------------------------------------------------------------------------

router.get('/banners', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM banners ORDER BY sort_order ASC, id ASC');
    res.json(rows);
  } catch (err) {
    console.error('Error listing banners (admin):', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/banners', async (req, res) => {
  try {
    const { title, subtitle, imageUrl, sortOrder, active } = req.body || {};
    if (!title || !imageUrl) return res.status(400).json({ error: 'Title and image URL are required.' });

    const [result] = await pool.query(
      'INSERT INTO banners (title, subtitle, image_url, sort_order, active) VALUES (?, ?, ?, ?, ?)',
      [String(title).trim(), subtitle || null, String(imageUrl).trim(), parseInt(sortOrder, 10) || 0, active !== false]
    );
    const [rows] = await pool.query('SELECT * FROM banners WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error creating banner:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/banners/:id', async (req, res) => {
  try {
    const { title, subtitle, imageUrl, sortOrder, active } = req.body || {};
    if (!title || !imageUrl) return res.status(400).json({ error: 'Title and image URL are required.' });

    const [result] = await pool.query(
      'UPDATE banners SET title = ?, subtitle = ?, image_url = ?, sort_order = ?, active = ? WHERE id = ?',
      [String(title).trim(), subtitle || null, String(imageUrl).trim(), parseInt(sortOrder, 10) || 0, active !== false, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Banner not found' });

    const [rows] = await pool.query('SELECT * FROM banners WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating banner:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/banners/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM banners WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Banner not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting banner:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// USERS
// ---------------------------------------------------------------------------

router.get('/users', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('Error listing users (admin):', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/users/:id/role', async (req, res) => {
  try {
    const role = req.body?.role;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: "role must be 'user' or 'admin'." });
    }

    // Don't let an admin lock themselves out by demoting themselves as the last admin.
    if (Number(req.params.id) === req.session.userId && role !== 'admin') {
      const [[{ adminCount }]] = await pool.query("SELECT COUNT(*) AS adminCount FROM users WHERE role = 'admin'");
      if (adminCount <= 1) {
        return res.status(400).json({ error: "You can't remove admin from the only remaining admin." });
      }
    }

    const [result] = await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found' });

    res.json({ id: Number(req.params.id), role });
  } catch (err) {
    console.error('Error updating user role:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    if (Number(req.params.id) === req.session.userId) {
      return res.status(400).json({ error: "You can't delete your own account from here." });
    }
    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
