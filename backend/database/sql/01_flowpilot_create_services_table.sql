-- =============================================================================
-- STEP 1 of 2 — Create missing `services` table (fixes "services doesn't exist")
-- Run this first in phpMyAdmin with database `flowpilot` selected.
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `services` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `project_id` bigint unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `period_label` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `status` varchar(24) NOT NULL DEFAULT 'active',
  `sort_order` smallint unsigned NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `services_project_id_foreign` (`project_id`),
  CONSTRAINT `services_project_id_foreign` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
