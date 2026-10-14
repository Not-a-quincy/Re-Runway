-- Migration: adds order tracking for the WhatsApp checkout flow.
-- Run this if you already loaded schema.sql before checkout existed.
--   mysql -u <DB_USER> -p <DB_NAME> < database/migration_orders.sql

USE `re-runway`;

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
