-- Re-Runway database schema
-- Run this once against the database named in your .env (DB_NAME) to set up all tables.
--   mysql -u <DB_USER> -p <DB_NAME> < database/schema.sql

SET NAMES utf8mb4;
ALTER DATABASE CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- USERS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('user','admin') NOT NULL DEFAULT 'user',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- NEWSLETTER
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  email      VARCHAR(190) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- BANNERS (already used by banner_router.js)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS banners (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  title      VARCHAR(160) NOT NULL,
  subtitle   VARCHAR(255),
  image_url  VARCHAR(500) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- CREATORS (attribution only — who sourced/made a piece. No login.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS creators (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  name              VARCHAR(150) NOT NULL,
  instagram_handle  VARCHAR(60) NULL,
  bio               TEXT,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- DROPS (season/event tags — e.g. "Onam 2026" — for grouping + promotion)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS drops (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(150) NOT NULL,
  slug       VARCHAR(170) NOT NULL UNIQUE,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- PRODUCTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  creator_id       INT NULL,
  drop_id          INT NULL,
  brand            VARCHAR(120) NOT NULL,
  name             VARCHAR(200) NOT NULL,
  slug             VARCHAR(220) NOT NULL UNIQUE,
  category         ENUM('T-Shirts','Shirts','Shorts','Denim','Outerwear','Knitwear','Footwear','Accessories') NOT NULL,
  price            DECIMAL(10,2) NOT NULL,
  original_price   DECIMAL(10,2) NULL,
  grade            ENUM('S','A','B','C') NULL,
  source           ENUM('Tokyo Exclusive','Vault Archive','Steal Deal') NULL,
  verified         BOOLEAN NOT NULL DEFAULT TRUE,
  condition_notes  TEXT,
  material_care    TEXT,
  seller_notes     TEXT,
  stock_qty        INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE SET NULL,
  FOREIGN KEY (drop_id) REFERENCES drops(id) ON DELETE SET NULL,
  INDEX idx_products_category (category),
  INDEX idx_products_grade (grade),
  INDEX idx_products_price (price),
  INDEX idx_products_creator (creator_id),
  INDEX idx_products_drop (drop_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Flexible per-category fields (collar type, pattern, fit, wash, etc.) —
-- one row per attribute per product, so new attributes never need a schema
-- change. See config/product_attributes.js for the defined key/label/options.
CREATE TABLE IF NOT EXISTS product_attributes (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  product_id      INT NOT NULL,
  attribute_key   VARCHAR(60) NOT NULL,
  attribute_value VARCHAR(120) NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_product_attr (product_id, attribute_key),
  INDEX idx_attr_key_value (attribute_key, attribute_value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_images (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  url        VARCHAR(500) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_sizes (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  size       VARCHAR(10) NOT NULL,
  in_stock   BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE KEY uniq_product_size (product_id, size),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- CARTS (one cart per logged-in user OR per guest session id)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS carts (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NULL,
  session_id VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_cart_user (user_id),
  UNIQUE KEY uniq_cart_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cart_items (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  cart_id    INT NOT NULL,
  product_id INT NOT NULL,
  size       VARCHAR(10) NOT NULL,
  qty        INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_cart_product_size (cart_id, product_id, size),
  FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- ORDERS (WhatsApp checkout — the order is recorded here first, then handed
-- off to WhatsApp for the actual conversation/payment confirmation)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  order_number      VARCHAR(20) NOT NULL UNIQUE,
  user_id           INT NULL,
  customer_name     VARCHAR(150) NOT NULL,
  customer_phone    VARCHAR(20) NOT NULL,
  shipping_address  TEXT NOT NULL,
  status            ENUM('pending','confirmed','cancelled') NOT NULL DEFAULT 'pending',
  subtotal          DECIMAL(10,2) NOT NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_orders_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  order_id     INT NOT NULL,
  product_id   INT NULL,
  brand        VARCHAR(120) NOT NULL,
  name         VARCHAR(200) NOT NULL,
  size         VARCHAR(10) NOT NULL,
  qty          INT NOT NULL,
  price        DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- SEED DATA — mirrors the placeholder content already in the EJS templates
-- ---------------------------------------------------------------------------
-- Default admin login: admin@rerunway.com / Admin@12345
-- CHANGE THIS PASSWORD IMMEDIATELY after your first login (see README).
INSERT INTO users (name, email, password_hash, role) VALUES
('Admin', 'admin@rerunway.com', '$2b$10$Fp1jE/1oxBE9z6t95j5BR.mv/dAENdgNofXm6J8sTnJS0MfWfG0IW', 'admin');

INSERT INTO banners (title, subtitle, image_url, sort_order) VALUES
('NEW DROP', 'Deadstock and export surplus, handpicked and quality-checked.', 'https://placehold.co/1600x900/1b1b1b/eeeeee?text=Re-Runway', 0),
('TOKYO EXCLUSIVES', 'Sourced directly from trusted partners in Tokyo.', 'https://placehold.co/1600x900/222222/eeeeee?text=Tokyo+Exclusives', 1),
('STEAL DEALS', 'Grade B and C pieces — minor factory flaws, steep discounts.', 'https://placehold.co/1600x900/333333/eeeeee?text=Steal+Deals', 2);

-- Sample creators — attribution only, replace with your real creators.
INSERT INTO creators (name, instagram_handle, bio) VALUES
('Studio Kochi', '@studiokochi', 'A small Kochi-based collective sourcing and reworking archive pieces.'),
('Nihal Threads', '@nihalthreads', 'Independent designer, exports and one-off surplus finds.');

-- Sample drop — this is the "season/event" tag, e.g. Onam 2026.
INSERT INTO drops (name, slug) VALUES
('Onam 2026', 'onam-2026');

INSERT INTO products (creator_id, drop_id, brand, name, slug, category, price, original_price, grade, source, verified, condition_notes, material_care, seller_notes, stock_qty) VALUES
(1, 1, 'CARHARTT WIP', 'Detroit Jacket, Duck Canvas', 'carhartt-wip-detroit-jacket-duck-canvas', 'Outerwear', 15800.00, 28000.00, 'A', NULL, TRUE,
  'Grade A — micro flaw. Faint fading on left cuff from the dye lot, barely visible unless you''re looking for it. No rips, tears, or stains. Original hardware intact, interior tag present and legible.',
  '100% cotton duck canvas, blanket-lined collar. Machine wash cold, hang dry. Do not iron directly on hardware.',
  'Brand deadstock, sourced directly from Carhartt WIP surplus.', 1),
(1, NULL, 'VISVIM', 'FBT Suede Low-Tops', 'visvim-fbt-suede-low-tops', 'Footwear', 34200.00, NULL, 'S', 'Tokyo Exclusive', TRUE,
  'Grade S — flawless. Factory-fresh, no visible flaws.', 'Suede upper. Spot clean only, use a suede brush.',
  'Export surplus sourced directly from a trusted Tokyo partner.', 2),
(2, 1, 'KAPITAL', 'Boro Patchwork Denim', 'kapital-boro-patchwork-denim', 'Denim', 22100.00, NULL, 'B', 'Vault Archive', FALSE,
  'Grade B — visible flaw. The boro-style patchwork is part of the original design, not damage; graded B for a minor stitching irregularity on the rear pocket. No structural issues.', 'Cold wash inside out, hang dry.',
  'Archive deadstock, verified before listing.', 1),
(2, NULL, 'NEEDLES', 'Track Jacket, Papillon', 'needles-track-jacket-papillon', 'Outerwear', 11900.00, NULL, 'C', 'Steal Deal', FALSE,
  'Grade C — overrun flaw. A noticeable print misalignment on the back panel, the reason this piece didn''t make retail shelves. Fully functional.', 'Machine wash cold, lay flat to dry.',
  'Export surplus, priced to move because of the print flaw above.', 3),
(1, NULL, 'CARHARTT WIP', 'OG Chore Coat', 'carhartt-wip-og-chore-coat', 'Outerwear', 13400.00, NULL, 'A', NULL, TRUE,
  'Grade A — micro flaw. A faint stitching irregularity on the inner seam, not visible when worn. Excellent structure otherwise.', '100% cotton, machine wash cold.',
  'Brand deadstock, sourced directly from Carhartt WIP surplus.', 2),
(2, NULL, 'STUSSY', 'Work Vest, Ripstop', 'stussy-work-vest-ripstop', 'Accessories', 8600.00, NULL, 'B', 'Steal Deal', FALSE,
  'Grade B — visible flaw. A small dye inconsistency on one pocket. No functional issues.', 'Machine wash cold.',
  'Export surplus, verified before listing.', 4);

INSERT INTO product_images (product_id, url, sort_order) VALUES
(1, 'https://placehold.co/700x800/eeeeee/1b1b1b?text=IMG+1', 0),
(1, 'https://placehold.co/700x800/eeeeee/1b1b1b?text=IMG+2', 1),
(1, 'https://placehold.co/700x800/eeeeee/1b1b1b?text=IMG+3', 2),
(1, 'https://placehold.co/700x800/eeeeee/1b1b1b?text=IMG+4', 3),
(2, 'https://placehold.co/700x800/eeeeee/1b1b1b?text=IMG+1', 0),
(3, 'https://placehold.co/700x800/eeeeee/1b1b1b?text=IMG+1', 0),
(4, 'https://placehold.co/700x800/eeeeee/1b1b1b?text=IMG+1', 0),
(5, 'https://placehold.co/700x800/eeeeee/1b1b1b?text=IMG+1', 0),
(6, 'https://placehold.co/700x800/eeeeee/1b1b1b?text=IMG+1', 0);

INSERT INTO product_sizes (product_id, size, in_stock) VALUES
(1, 'S', TRUE), (1, 'M', TRUE), (1, 'L', TRUE), (1, 'XL', FALSE),
(2, 'UK 8', TRUE), (2, 'UK 9', TRUE), (2, 'UK 10', TRUE),
(3, '30', TRUE), (3, '32', TRUE), (3, '34', TRUE),
(4, 'S', TRUE), (4, 'M', TRUE), (4, 'L', TRUE),
(5, 'M', TRUE), (5, 'L', TRUE), (5, 'XL', TRUE),
(6, 'S', TRUE), (6, 'M', TRUE), (6, 'L', TRUE), (6, 'XL', TRUE);

-- Example category-specific attributes (color, pattern, fit, etc.)
INSERT INTO product_attributes (product_id, attribute_key, attribute_value) VALUES
(1, 'color', 'Brown'), (1, 'pattern', 'Solid'), (1, 'closure_type', 'Button'), (1, 'collar_type', 'Collared'),
(2, 'color', 'Beige'),
(3, 'color', 'Blue'), (3, 'fit', 'Straight'), (3, 'wash', 'Medium Wash'), (3, 'rise', 'Mid Rise'),
(4, 'color', 'Olive'), (4, 'pattern', 'Colorblock'), (4, 'closure_type', 'Zip'), (4, 'collar_type', 'Crew'),
(5, 'color', 'Black'), (5, 'pattern', 'Solid'), (5, 'closure_type', 'Button'), (5, 'collar_type', 'Collared'),
(6, 'color', 'Olive'), (6, 'material_type', 'Cotton');
