-- =============================================================================
-- FINAL — ONE PASTE: FlowPilot agency workflow schema (deliverable layer)
--
-- Fixes:
--   • Unknown column 'tasks.deliverable_id'
--   • Missing deliverables.sort_order, tasks.workflow_step
--   • Missing table deliverables (creates if needed)
--   • Missing tasks.service_id (adds if needed)
--
-- HOW TO RUN (phpMyAdmin):
--   1. Click database `flowpilot` on the LEFT (or edit USE below).
--   2. SQL tab → paste this ENTIRE file → Go.
--
-- Then (recommended): backend folder → php artisan migrate --force
-- =============================================================================

USE `flowpilot`;

SET NAMES utf8mb4;
SET @db := IFNULL(NULLIF(TRIM(DATABASE()), ''), 'flowpilot');

SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- A) deliverables table (only if it does not exist yet)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `deliverables` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `service_id` bigint unsigned NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `status` varchar(32) NOT NULL DEFAULT 'pending',
  `submission_url` varchar(2048) DEFAULT NULL,
  `internal_notes` text DEFAULT NULL,
  `submitted_at` timestamp NULL DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `deliverables_service_id_foreign` (`service_id`),
  CONSTRAINT `deliverables_service_id_foreign` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- B) deliverables.sort_order
-- ---------------------------------------------------------------------------
SET @has_so := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'deliverables' AND COLUMN_NAME = 'sort_order'
);
SET @sql_so := IF(
  @has_so > 0,
  'SELECT ''OK: deliverables.sort_order'' AS notice',
  'ALTER TABLE `deliverables` ADD COLUMN `sort_order` SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER `service_id`'
);
PREPARE ps_so FROM @sql_so;
EXECUTE ps_so;
DEALLOCATE PREPARE ps_so;

-- ---------------------------------------------------------------------------
-- C) tasks.service_id (nullable FK → services) — only if column missing
-- ---------------------------------------------------------------------------
SET @has_sid := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'service_id'
);
SET @sql_sid := IF(
  @has_sid > 0,
  'SELECT ''OK: tasks.service_id'' AS notice',
  'ALTER TABLE `tasks` ADD COLUMN `service_id` BIGINT UNSIGNED NULL AFTER `project_id`'
);
PREPARE ps_sid FROM @sql_sid;
EXECUTE ps_sid;
DEALLOCATE PREPARE ps_sid;

SET @fk_sid := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @db AND TABLE_NAME = 'tasks'
    AND CONSTRAINT_NAME = 'tasks_service_id_foreign' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql_fksid := IF(
  @fk_sid > 0,
  'SELECT ''OK: tasks_service_id_foreign'' AS notice',
  'ALTER TABLE `tasks` ADD CONSTRAINT `tasks_service_id_foreign` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE SET NULL'
);
PREPARE ps_fksid FROM @sql_fksid;
EXECUTE ps_fksid;
DEALLOCATE PREPARE ps_fksid;

-- ---------------------------------------------------------------------------
-- D) tasks.deliverable_id + workflow_step + FK → deliverables
-- ---------------------------------------------------------------------------
SET @has_did := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'deliverable_id'
);
SET @sql_did := IF(
  @has_did > 0,
  'SELECT ''OK: tasks.deliverable_id'' AS notice',
  'ALTER TABLE `tasks` ADD COLUMN `deliverable_id` BIGINT UNSIGNED NULL AFTER `service_id`'
);
PREPARE ps_did FROM @sql_did;
EXECUTE ps_did;
DEALLOCATE PREPARE ps_did;

SET @has_ws := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'workflow_step'
);
SET @sql_ws := IF(
  @has_ws > 0,
  'SELECT ''OK: tasks.workflow_step'' AS notice',
  'ALTER TABLE `tasks` ADD COLUMN `workflow_step` TINYINT UNSIGNED NULL AFTER `deliverable_id`'
);
PREPARE ps_ws FROM @sql_ws;
EXECUTE ps_ws;
DEALLOCATE PREPARE ps_ws;

SET @fk_did := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @db AND TABLE_NAME = 'tasks'
    AND CONSTRAINT_NAME = 'tasks_deliverable_id_foreign' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql_fkdid := IF(
  @fk_did > 0,
  'SELECT ''OK: tasks_deliverable_id_foreign'' AS notice',
  'ALTER TABLE `tasks` ADD CONSTRAINT `tasks_deliverable_id_foreign` FOREIGN KEY (`deliverable_id`) REFERENCES `deliverables` (`id`) ON DELETE CASCADE'
);
PREPARE ps_fkdid FROM @sql_fkdid;
EXECUTE ps_fkdid;
DEALLOCATE PREPARE ps_fkdid;

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'FLOWPILOT SCHEMA OK — refresh admin (Services / Tasks). Run: php artisan migrate --force' AS done;
