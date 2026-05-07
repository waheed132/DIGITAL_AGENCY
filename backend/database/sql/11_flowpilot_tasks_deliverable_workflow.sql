-- =============================================================================
-- COMPLETE FIX: Unknown column 'tasks.deliverable_id' (FlowPilot / flowpilot DB)
--
-- In phpMyAdmin: click database `flowpilot` in the left sidebar, then SQL tab,
-- paste this ENTIRE file and click Go.
--
-- If your database name is NOT `flowpilot`, change the USE line below once.
--
-- After this succeeds, open a terminal in `backend` and run:
--   php artisan migrate --force
-- (moves old tasks under deliverables — optional but recommended)
-- =============================================================================

USE `flowpilot`;

SET NAMES utf8mb4;
SET @db := DATABASE();

-- Must match the DB you selected (avoids wrong schema when DATABASE() is empty)
SET @db := IFNULL(NULLIF(TRIM(@db), ''), 'flowpilot');

SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- 1) deliverables.sort_order
-- ---------------------------------------------------------------------------
SET @has_so := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'deliverables' AND COLUMN_NAME = 'sort_order'
);
SET @sql_so := IF(
  @has_so > 0,
  'SELECT ''OK: deliverables.sort_order already exists'' AS notice',
  'ALTER TABLE `deliverables` ADD COLUMN `sort_order` SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER `service_id`'
);
PREPARE ps_so FROM @sql_so;
EXECUTE ps_so;
DEALLOCATE PREPARE ps_so;

-- ---------------------------------------------------------------------------
-- 2) tasks.deliverable_id  (links each workflow task → deliverables.id)
-- ---------------------------------------------------------------------------
SET @has_did := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'deliverable_id'
);
SET @sql_did := IF(
  @has_did > 0,
  'SELECT ''OK: tasks.deliverable_id already exists'' AS notice',
  'ALTER TABLE `tasks` ADD COLUMN `deliverable_id` BIGINT UNSIGNED NULL AFTER `service_id`'
);
PREPARE ps_did FROM @sql_did;
EXECUTE ps_did;
DEALLOCATE PREPARE ps_did;

-- ---------------------------------------------------------------------------
-- 3) tasks.workflow_step  (1–5 = Script → … → Final delivery)
-- ---------------------------------------------------------------------------
SET @has_ws := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'workflow_step'
);
SET @sql_ws := IF(
  @has_ws > 0,
  'SELECT ''OK: tasks.workflow_step already exists'' AS notice',
  'ALTER TABLE `tasks` ADD COLUMN `workflow_step` TINYINT UNSIGNED NULL AFTER `deliverable_id`'
);
PREPARE ps_ws FROM @sql_ws;
EXECUTE ps_ws;
DEALLOCATE PREPARE ps_ws;

-- ---------------------------------------------------------------------------
-- 4) Foreign key tasks.deliverable_id → deliverables.id (ON DELETE CASCADE)
-- ---------------------------------------------------------------------------
SET @fk := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @db
    AND TABLE_NAME = 'tasks'
    AND CONSTRAINT_NAME = 'tasks_deliverable_id_foreign'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql_fk := IF(
  @fk > 0,
  'SELECT ''OK: FK tasks_deliverable_id_foreign already exists'' AS notice',
  'ALTER TABLE `tasks`
     ADD CONSTRAINT `tasks_deliverable_id_foreign`
     FOREIGN KEY (`deliverable_id`) REFERENCES `deliverables` (`id`)
     ON DELETE CASCADE'
);
PREPARE ps_fk FROM @sql_fk;
EXECUTE ps_fk;
DEALLOCATE PREPARE ps_fk;

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'DONE: tasks.deliverable_id + workflow_step added. Refresh FlowPilot admin.' AS result;

-- =============================================================================
-- FALLBACK (only if prepared statements fail in your phpMyAdmin build):
-- Run ONE AT A TIME; ignore "Duplicate column" / "Duplicate foreign key".
--
-- USE `flowpilot`;
-- ALTER TABLE `deliverables` ADD COLUMN `sort_order` SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER `service_id`;
-- ALTER TABLE `tasks` ADD COLUMN `deliverable_id` BIGINT UNSIGNED NULL AFTER `service_id`;
-- ALTER TABLE `tasks` ADD COLUMN `workflow_step` TINYINT UNSIGNED NULL AFTER `deliverable_id`;
-- SET FOREIGN_KEY_CHECKS = 0;
-- ALTER TABLE `tasks` ADD CONSTRAINT `tasks_deliverable_id_foreign`
--   FOREIGN KEY (`deliverable_id`) REFERENCES `deliverables` (`id`) ON DELETE CASCADE;
-- SET FOREIGN_KEY_CHECKS = 1;
-- =============================================================================
