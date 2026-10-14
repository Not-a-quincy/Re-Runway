-- Migration: adds flexible per-category product attributes (collar type,
-- pattern, color, fit, wash, etc.) and expands the category list.
-- Run this if you already loaded schema.sql before this existed.
--   mysql -u <DB_USER> -p <DB_NAME> < database/migration_attributes.sql

USE `re-runway`;

CREATE TABLE IF NOT EXISTS product_attributes (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  product_id      INT NOT NULL,
  attribute_key   VARCHAR(60) NOT NULL,
  attribute_value VARCHAR(120) NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_product_attr (product_id, attribute_key),
  INDEX idx_attr_key_value (attribute_key, attribute_value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Adds T-Shirts, Shirts, Shorts alongside your existing categories.
ALTER TABLE products
  MODIFY COLUMN category ENUM('T-Shirts','Shirts','Shorts','Denim','Outerwear','Knitwear','Footwear','Accessories') NOT NULL;
