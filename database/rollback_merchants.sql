-- Rollback: removes the abandoned multi-merchant system, if you ran
-- migration_merchants.sql before this plan was scrapped.
-- Safe to run even if you never ran that migration — every statement
-- checks existence first.
--   mysql -u <DB_USER> -p <DB_NAME> < database/rollback_merchants.sql

USE `re-runway`;

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'merchant_id'
);
SET @sql := IF(@has_col > 0,
  'ALTER TABLE orders DROP FOREIGN KEY fk_orders_merchant, DROP COLUMN merchant_id, DROP COLUMN merchant_name, DROP COLUMN merchant_whatsapp_number',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'merchant_id'
);
SET @sql := IF(@has_col > 0,
  'ALTER TABLE products DROP FOREIGN KEY fk_products_merchant, DROP COLUMN merchant_id',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

DROP TABLE IF EXISTS merchants;
