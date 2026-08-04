import express from 'express';
import pool from '../database/db.js';

const router = express.Router();

const ALLOWED_CATEGORIES = ['Outerwear', 'Denim', 'Knitwear', 'Footwear', 'Accessories'];
const ALLOWED_GRADES = ['S', 'A', 'B', 'C'];
const ALLOWED_AUDIENCE = ['Men', 'Women', 'Unisex'];
// Brand is free text in the DB (not an ENUM), so this isn't a hard allowlist —
// it's just the current catalogue's brand set, used to render filter checkboxes.
// New brands added via the admin panel will still be filterable even if not listed here.
const KNOWN_BRANDS = ['Carhartt WIP', 'Visvim', 'Kapital', 'Needles', 'Stussy'];

const SORT_MAP = {
  newest: 'p.created_at DESC',
  price_asc: 'p.price ASC',
  price_desc: 'p.price DESC',
  grade: "FIELD(p.grade, 'S','A','B','C') ASC",
};

// Normalize a comma-separated query param ("Outerwear,Denim") into a clean array
function parseListParam(value, allowed) {
  if (!value) return [];
  const items = String(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  return allowed ? items.filter((v) => allowed.includes(v)) : items;
}

function mapProductRow(row) {
  return {
    id: row.id,
    brand: row.brand,
    name: row.name,
    slug: row.slug,
    category: row.category,
    price: Number(row.price),
    originalPrice: row.original_price != null ? Number(row.original_price) : null,
    discountPercent:
      row.original_price != null && Number(row.original_price) > 0
        ? Math.round((1 - Number(row.price) / Number(row.original_price)) * 100)
        : null,
    grade: row.grade,
    audience: row.audience,
    verified: !!row.verified,
    image: row.image_url || 'https://placehold.co/400x500/eeeeee/1b1b1b?text=IMG',
    inStock: row.stock_qty > 0,
  };
}

// GET /api/products
// Query params: category, grade, audience, brand, size, minPrice, maxPrice, sort, page, pageSize, q
router.get('/', async (req, res) => {
  try {
    const categories = parseListParam(req.query.category, ALLOWED_CATEGORIES);
    const grades = parseListParam(req.query.grade, ALLOWED_GRADES);
    const audiences = parseListParam(req.query.audience, ALLOWED_AUDIENCE);
    // Brand isn't restricted to KNOWN_BRANDS — any brand actually in the DB
    // (including ones added later via the admin panel) is filterable.
    const brands = parseListParam(req.query.brand);
    const sizes = parseListParam(req.query.size);
    const minPrice = req.query.minPrice ? Number(req.query.minPrice) : null;
    const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : null;
    const search = req.query.q ? String(req.query.q).trim() : '';
    const sortKey = SORT_MAP[req.query.sort] ? req.query.sort : 'newest';

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(60, Math.max(1, parseInt(req.query.pageSize, 10) || 12));
    const offset = (page - 1) * pageSize;

    const where = [];
    const params = [];

    if (categories.length) {
      where.push(`p.category IN (${categories.map(() => '?').join(',')})`);
      params.push(...categories);
    }
    if (grades.length) {
      where.push(`p.grade IN (${grades.map(() => '?').join(',')})`);
      params.push(...grades);
    }
    if (audiences.length) {
      where.push(`p.audience IN (${audiences.map(() => '?').join(',')})`);
      params.push(...audiences);
    }
    if (brands.length) {
      where.push(`p.brand IN (${brands.map(() => '?').join(',')})`);
      params.push(...brands);
    }
    if (sizes.length) {
      where.push(
        `p.id IN (SELECT ps.product_id FROM product_sizes ps WHERE ps.in_stock = TRUE AND ps.size IN (${sizes
          .map(() => '?')
          .join(',')}))`
      );
      params.push(...sizes);
    }
    if (minPrice != null && !Number.isNaN(minPrice)) {
      where.push('p.price >= ?');
      params.push(minPrice);
    }
    if (maxPrice != null && !Number.isNaN(maxPrice)) {
      where.push('p.price <= ?');
      params.push(maxPrice);
    }
    if (search) {
      where.push('(p.name LIKE ? OR p.brand LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM products p ${whereSql}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.query(
      `SELECT p.*, (
         SELECT pi.url FROM product_images pi
         WHERE pi.product_id = p.id ORDER BY pi.sort_order ASC LIMIT 1
       ) AS image_url
       FROM products p
       ${whereSql}
       ORDER BY ${SORT_MAP[sortKey]}
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    res.json({
      items: rows.map(mapProductRow),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/products/:id  (or slug)
router.get('/:id', async (req, res) => {
  try {
    const identifier = req.params.id;
    const isNumeric = /^\d+$/.test(identifier);

    const [rows] = await pool.query(
      `SELECT * FROM products WHERE ${isNumeric ? 'id = ?' : 'slug = ?'} LIMIT 1`,
      [identifier]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = rows[0];

    const [images] = await pool.query(
      'SELECT url FROM product_images WHERE product_id = ? ORDER BY sort_order ASC',
      [product.id]
    );
    const [sizes] = await pool.query(
      'SELECT size, in_stock FROM product_sizes WHERE product_id = ? ORDER BY id ASC',
      [product.id]
    );
    const [related] = await pool.query(
      `SELECT p.*, (
         SELECT pi.url FROM product_images pi
         WHERE pi.product_id = p.id ORDER BY pi.sort_order ASC LIMIT 1
       ) AS image_url
       FROM products p
       WHERE p.category = ? AND p.id != ?
       ORDER BY RAND() LIMIT 5`,
      [product.category, product.id]
    );

    res.json({
      ...mapProductRow({ ...product, image_url: images[0]?.url }),
      description: product.condition_notes,
      conditionNotes: product.condition_notes,
      materialCare: product.material_care,
      sellerNotes: product.seller_notes,
      images: images.map((i) => i.url),
      sizes: sizes.map((s) => ({ size: s.size, inStock: !!s.in_stock })),
      related: related.map(mapProductRow),
    });
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
