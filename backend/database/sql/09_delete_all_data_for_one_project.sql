-- =============================================================================
-- Remove ALL data tied to ONE project (tasks, services, deliverables, members,
-- planned billing rows on `services`, etc.).
--
-- NOT covered (no project link in this app):
--   - `office_expenses` / `office_expense_advances` — these are org-wide, not
--     per project. To remove specific expense rows, delete by `id` or run a
--     separate WHERE clause (e.g. by date) — never assume they belong to a project.
-- =============================================================================
-- Before running, pick your project id (phpMyAdmin / MySQL client):

-- SELECT id, name, client_id, created_at FROM projects ORDER BY id DESC;

SET @project_id = 0;  -- <<< REPLACE with your project id (must be > 0)

-- -----------------------------------------------------------------------------
-- 1) DRY RUN — row counts (run with @project_id set)
-- -----------------------------------------------------------------------------
-- SELECT
--   (SELECT COUNT(*) FROM project_user WHERE project_id = @project_id) AS project_users,
--   (SELECT COUNT(*) FROM services WHERE project_id = @project_id) AS services,
--   (SELECT COUNT(*) FROM tasks WHERE project_id = @project_id) AS tasks,
--   (SELECT COUNT(*) FROM task_attachments WHERE task_id IN (SELECT id FROM tasks WHERE project_id = @project_id)) AS task_attachments,
--   (SELECT COUNT(*) FROM deliverables d INNER JOIN services s ON d.service_id = s.id WHERE s.project_id = @project_id) AS deliverables;

-- -----------------------------------------------------------------------------
-- 2) Orphaned activity log rows (no FK — clean before / after)
--    Class names must match `activity_logs.subject_type` (Laravel FQCN).
-- -----------------------------------------------------------------------------
-- DELETE al FROM activity_logs al
-- INNER JOIN tasks t ON t.id = al.subject_id AND al.subject_type = 'App\\Models\\Task'
-- WHERE t.project_id = @project_id;
--
-- DELETE al FROM activity_logs al
-- INNER JOIN deliverables d ON d.id = al.subject_id AND al.subject_type = 'App\\Models\\Deliverable'
-- INNER JOIN services s ON s.id = d.service_id
-- WHERE s.project_id = @project_id;
--
-- DELETE al FROM activity_logs al
-- INNER JOIN services s ON s.id = al.subject_id AND al.subject_type = 'App\\Models\\AgencyService'
-- WHERE s.project_id = @project_id;
--
-- DELETE FROM activity_logs
-- WHERE subject_type = 'App\\Models\\Project' AND subject_id = @project_id;

-- -----------------------------------------------------------------------------
-- 3) DELETE the project (children cascade if FKs match Laravel migrations)
--    If this fails on FK, use section 4 instead.
-- -----------------------------------------------------------------------------
-- START TRANSACTION;
-- DELETE FROM projects WHERE id = @project_id AND @project_id > 0;
-- -- SELECT ROW_COUNT();
-- COMMIT;

-- -----------------------------------------------------------------------------
-- 4) EXPLICIT order (if CASCADE is missing on your database)
-- -----------------------------------------------------------------------------
-- SET FOREIGN_KEY_CHECKS = 0;  -- only if you know you need it; avoid on prod casually
-- START TRANSACTION;
-- DELETE ta FROM task_attachments ta
-- INNER JOIN tasks t ON t.id = ta.task_id WHERE t.project_id = @project_id;
-- DELETE t FROM tasks t WHERE t.project_id = @project_id;
-- DELETE d FROM deliverables d
-- INNER JOIN services s ON s.id = d.service_id WHERE s.project_id = @project_id;
-- DELETE FROM services WHERE project_id = @project_id;
-- DELETE FROM project_user WHERE project_id = @project_id;
-- DELETE FROM projects WHERE id = @project_id;
-- COMMIT;
-- SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------------------------------------------
-- 5) Optional: clear ONLY office expenses you created (by id or time window)
--     Does NOT use @project_id — office expenses are not linked to projects.
-- -----------------------------------------------------------------------------
-- Example by primary keys (safest):
-- DELETE FROM office_expenses WHERE id IN (1, 2, 3);
-- Example by a test day:
-- DELETE FROM office_expenses WHERE expense_date = '2026-04-22';
