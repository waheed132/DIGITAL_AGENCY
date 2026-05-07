-- Run in phpMyAdmin on database `flowpilot` if `office_expenses` is missing.
-- Matches Laravel migration: 2026_04_22_100000_create_office_expenses_table.php
-- If you still have the old schema (due_date, type, status), run migrations instead:
--   php artisan migrate
--   (2026_04_23_100000_refactor_office_expenses_flexible_categories.php converts legacy rows)

CREATE TABLE IF NOT EXISTS `office_expenses` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `expense_date` date NOT NULL,
  `category` varchar(32) NOT NULL DEFAULT 'other',
  `assigned_to` varchar(32) NOT NULL DEFAULT 'me',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `office_expenses_expense_date_index` (`expense_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Repair existing `office_expenses` when Laravel reports:
--   Unknown column 'expense_date' in 'field list'
-- Run each statement that applies; skip if MySQL says the column exists.
-- Or from project backend folder: php artisan migrate
-- (migration 2026_04_24_120000_ensure_office_expenses_columns.php).
-- ---------------------------------------------------------------------------
-- ALTER TABLE `office_expenses` ADD COLUMN `expense_date` date DEFAULT NULL AFTER `amount`;
-- UPDATE `office_expenses` SET `expense_date` = CURDATE() WHERE `expense_date` IS NULL;
-- ALTER TABLE `office_expenses` MODIFY `expense_date` date NOT NULL;
--
-- ALTER TABLE `office_expenses` ADD COLUMN `category` varchar(32) NOT NULL DEFAULT 'other' AFTER `expense_date`;
-- ALTER TABLE `office_expenses` ADD COLUMN `notes` text DEFAULT NULL AFTER `category`;

-- ---------------------------------------------------------------------------
-- Fix MySQL 1364: Field 'due_date' doesn't have a default value
-- Does NOT use information_schema (some hosts deny access — avoids error #1044).
-- Select database `flowpilot`. Run statements one at a time; if MySQL says
-- "Unknown column", skip that line and continue.
-- ---------------------------------------------------------------------------

UPDATE `office_expenses` SET `expense_date` = `due_date` WHERE `expense_date` IS NULL AND `due_date` IS NOT NULL;
UPDATE `office_expenses` SET `expense_date` = CURDATE() WHERE `expense_date` IS NULL;
ALTER TABLE `office_expenses` MODIFY `expense_date` date NOT NULL;

-- Smallest change: legacy columns allow NULL so inserts without them succeed
ALTER TABLE `office_expenses` MODIFY `due_date` date NULL DEFAULT NULL;
ALTER TABLE `office_expenses` MODIFY `type` varchar(32) NULL DEFAULT NULL;
ALTER TABLE `office_expenses` MODIFY `status` varchar(16) NULL DEFAULT NULL;

-- Optional — final schema like Laravel (drop legacy columns; skip lines that error)
-- ALTER TABLE `office_expenses` DROP COLUMN `due_date`;
-- ALTER TABLE `office_expenses` DROP COLUMN `type`;
-- ALTER TABLE `office_expenses` DROP COLUMN `status`;
