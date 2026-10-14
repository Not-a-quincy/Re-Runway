-- Migration: adds the newsletter signup table.
-- Run this if you already loaded schema.sql before this existed.
--   mysql -u <DB_USER> -p <DB_NAME> < database/migration_newsletter.sql

USE `re-runway`;

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  email      VARCHAR(190) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
