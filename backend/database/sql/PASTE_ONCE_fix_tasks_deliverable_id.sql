-- Paste in phpMyAdmin with database `flowpilot` selected (change USE if needed).
-- Ignore errors: Duplicate column name / Duplicate foreign key (means already applied).

USE `flowpilot`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

ALTER TABLE `deliverables`
  ADD COLUMN `sort_order` SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER `service_id`;

ALTER TABLE `tasks`
  ADD COLUMN `deliverable_id` BIGINT UNSIGNED NULL AFTER `service_id`;

ALTER TABLE `tasks`
  ADD COLUMN `workflow_step` TINYINT UNSIGNED NULL AFTER `deliverable_id`;

ALTER TABLE `tasks`
  ADD CONSTRAINT `tasks_deliverable_id_foreign`
  FOREIGN KEY (`deliverable_id`) REFERENCES `deliverables` (`id`) ON DELETE CASCADE;

SET FOREIGN_KEY_CHECKS = 1;
