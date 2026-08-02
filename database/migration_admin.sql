-- Migration: adds admin support to an existing Re-Runway database.
-- Run this if you already loaded schema.sql before the admin panel existed.
--   mysql -u <DB_USER> -p <DB_NAME> < database/migration_admin.sql

USE `re-runway`;

ALTER TABLE users
  ADD COLUMN role ENUM('user','admin') NOT NULL DEFAULT 'user' AFTER password_hash;

-- Default admin login: admin@rerunway.com / Admin@12345
-- CHANGE THIS PASSWORD IMMEDIATELY after your first login.
-- If a user with this email already exists, this just promotes them to admin
-- instead of creating a duplicate.
INSERT INTO users (name, email, password_hash, role)
VALUES ('Admin', 'admin@rerunway.com', '$2b$10$Fp1jE/1oxBE9z6t95j5BR.mv/dAENdgNofXm6J8sTnJS0MfWfG0IW', 'admin')
ON DUPLICATE KEY UPDATE role = 'admin';
