-- Migration: adds creator attribution + drop/season tagging to products.
-- Run this if you already loaded schema.sql before this existed.
--   mysql -u <DB_USER> -p <DB_NAME> < database/migration_creators_drops.sql
--
-- NOTE: if you ran an earlier migration_merchants.sql, run
-- database/rollback_merchants.sql FIRST to remove that table, then run this.

USE `re-runway`;

CREATE TABLE IF NOT EXISTS creators (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  name              VARCHAR(150) NOT NULL,
  instagram_handle  VARCHAR(60) NULL,
  bio               TEXT,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS drops (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(150) NOT NULL,
  slug       VARCHAR(170) NOT NULL UNIQUE,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE products
  ADD COLUMN creator_id INT NULL AFTER id,
  ADD COLUMN drop_id INT NULL AFTER creator_id,
  ADD CONSTRAINT fk_products_creator FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_products_drop FOREIGN KEY (drop_id) REFERENCES drops(id) ON DELETE SET NULL,
  ADD INDEX idx_products_creator (creator_id),
  ADD INDEX idx_products_drop (drop_id);

-- Grade/source should already be nullable from an earlier migration — this
-- is safe to re-run either way.
ALTER TABLE products
  MODIFY COLUMN grade ENUM('S','A','B','C') NULL,
  MODIFY COLUMN source ENUM('Tokyo Exclusive','Vault Archive','Steal Deal') NULL;
