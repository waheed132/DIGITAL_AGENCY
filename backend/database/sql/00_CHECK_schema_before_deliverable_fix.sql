-- =============================================================================
-- SAFE checks before running 11_flowpilot_tasks_deliverable_workflow.sql
--
-- Fixes phpMyAdmin error: #1109 Unknown table 'tasks' in information_schema
-- Cause: no database selected → always USE your DB first (see line below).
-- =============================================================================

-- ►►► CHANGE ONLY IF YOUR DB NAME IS NOT flowpilot ◄◄◄
USE `flowpilot`;

SET @db := DATABASE();

-- 1) Required tables (uses information_schema — no SHOW FROM tasks needed)
SELECT TABLE_NAME AS ok_table
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = @db
  AND TABLE_NAME IN ('services', 'deliverables', 'tasks')
ORDER BY TABLE_NAME;

-- 2) tasks columns (qualified — avoids #1109)
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @db
  AND TABLE_NAME = 'tasks'
  AND COLUMN_NAME IN ('service_id', 'deliverable_id', 'workflow_step')
ORDER BY COLUMN_NAME;

-- 3) deliverables.sort_order present?
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @db
  AND TABLE_NAME = 'deliverables'
  AND COLUMN_NAME = 'sort_order';

-- Expected before fix 11: service_id exists; deliverable_id & workflow_step missing.
SELECT 'If deliverable_id row is empty above, run 11_flowpilot_tasks_deliverable_workflow.sql next.' AS next_step;
