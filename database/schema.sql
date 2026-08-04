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
-- NEWSLETTER SUBSCRIBERS (used by newsletter_router.js, footer signup form)
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
-- PRODUCTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  brand            VARCHAR(120) NOT NULL,
  name             VARCHAR(200) NOT NULL,
  slug             VARCHAR(220) NOT NULL UNIQUE,
  category         ENUM('Outerwear','Denim','Knitwear','Footwear','Accessories') NOT NULL,
  audience         ENUM('Men','Women','Unisex') NOT NULL DEFAULT 'Unisex',
  price            DECIMAL(10,2) NOT NULL,
  original_price   DECIMAL(10,2) NULL,
  grade            ENUM('S','A','B','C') NOT NULL,
  verified         BOOLEAN NOT NULL DEFAULT TRUE,
  condition_notes  TEXT,
  material_care    TEXT,
  seller_notes     TEXT,
  stock_qty        INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_products_brand (brand),
  INDEX idx_products_category (category),
  INDEX idx_products_audience (audience),
  INDEX idx_products_grade (grade),
  INDEX idx_products_price (price)
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
-- SEED DATA — mirrors the placeholder content already in the EJS templates
-- ---------------------------------------------------------------------------
-- Default admin login: admin@rerunway.com / Admin@12345
-- CHANGE THIS PASSWORD IMMEDIATELY after your first login (see README).
INSERT INTO users (name, email, password_hash, role) VALUES
('Admin', 'admin@rerunway.com', '$2b$10$Fp1jE/1oxBE9z6t95j5BR.mv/dAENdgNofXm6J8sTnJS0MfWfG0IW', 'admin');

INSERT INTO banners (title, subtitle, image_url, sort_order) VALUES
('NEW DROP', 'Deadstock and export surplus, handpicked and quality-checked.', 'https://placehold.co/1600x900/1b1b1b/eeeeee?text=Re-Runway', 0),
('BRAND DEADSTOCK', 'Carhartt WIP, Visvim, Kapital, Needles, Stussy — sourced directly, verified before listing.', 'https://placehold.co/1600x900/222222/eeeeee?text=Brand+Deadstock', 1),
('STEAL DEALS', 'Grade B and C pieces — minor factory flaws, steep discounts.', 'https://placehold.co/1600x900/333333/eeeeee?text=Steal+Deals', 2);

INSERT INTO products (brand, name, slug, category, audience, price, original_price, grade, verified, condition_notes, material_care, seller_notes, stock_qty) VALUES
('CARHARTT WIP', 'Detroit Jacket, Duck Canvas', 'carhartt-wip-detroit-jacket-duck-canvas', 'Outerwear', 'Unisex', 15800.00, 28000.00, 'A', TRUE,
  'Grade A — micro flaw. Faint fading on left cuff from the dye lot, barely visible unless you''re looking for it. No rips, tears, or stains. Original hardware intact, interior tag present and legible.',
  '100% cotton duck canvas, blanket-lined collar. Machine wash cold, hang dry. Do not iron directly on hardware.',
  'Brand deadstock, sourced directly from Carhartt WIP surplus.', 1),
('VISVIM', 'FBT Suede Low-Tops', 'visvim-fbt-suede-low-tops', 'Footwear', 'Men', 34200.00, NULL, 'S', TRUE,
  'Grade S — flawless. Factory-fresh, no visible flaws.', 'Suede upper. Spot clean only, use a suede brush.',
  'Export surplus, verified before listing.', 2),
('KAPITAL', 'Boro Patchwork Denim', 'kapital-boro-patchwork-denim', 'Denim', 'Unisex', 22100.00, NULL, 'B', FALSE,
  'Grade B — visible flaw. The boro-style patchwork is part of the original design, not damage; graded B for a minor stitching irregularity on the rear pocket. No structural issues.', 'Cold wash inside out, hang dry.',
  'Archive deadstock, verified before listing.', 1),
('NEEDLES', 'Track Jacket, Papillon', 'needles-track-jacket-papillon', 'Outerwear', 'Women', 11900.00, NULL, 'C', FALSE,
  'Grade C — overrun flaw. A noticeable print misalignment on the back panel, the reason this piece didn''t make retail shelves. Fully functional.', 'Machine wash cold, lay flat to dry.',
  'Export surplus, priced to move because of the print flaw above.', 3),
('CARHARTT WIP', 'OG Chore Coat', 'carhartt-wip-og-chore-coat', 'Outerwear', 'Unisex', 13400.00, NULL, 'A', TRUE,
  'Grade A — micro flaw. A faint stitching irregularity on the inner seam, not visible when worn. Excellent structure otherwise.', '100% cotton, machine wash cold.',
  'Brand deadstock, sourced directly from Carhartt WIP surplus.', 2),
('STUSSY', 'Work Vest, Ripstop', 'stussy-work-vest-ripstop', 'Accessories', 'Unisex', 8600.00, NULL, 'B', FALSE,
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
