-- =============================================================================
-- STEP 2 of 2 — Add nullable `service_id` on `tasks` (only if column is missing)
--
-- BEFORE RUNNING: open `tasks` table → Structure tab → confirm `service_id` is
-- NOT listed. If it already exists, skip this file entirely.
--
-- Requires: `services` table from 01_flowpilot_create_services_table.sql
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

ALTER TABLE `tasks`
  ADD COLUMN `service_id` bigint unsigned NULL AFTER `project_id`;

ALTER TABLE `tasks`
  ADD CONSTRAINT `tasks_service_id_foreign`
  FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE SET NULL;

SET FOREIGN_KEY_CHECKS = 1;
