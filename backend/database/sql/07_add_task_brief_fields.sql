-- =========================================================================
-- flowpilot / tasks — Task brief + client input columns
-- =========================================================================
-- In phpMyAdmin: select database `flowpilot` (or your app DB), then SQL tab.
-- Run the blocks below ONE AT A TIME. If a line says "Duplicate column name",
-- that column already exists — skip it and run the next line.
-- =========================================================================

-- 1) Client-provided text (captions, quotes, copy)
ALTER TABLE `tasks` ADD COLUMN `client_content` TEXT NULL;

-- 2) Style / reference link (Instagram, Figma, etc.)
ALTER TABLE `tasks` ADD COLUMN `reference_url` VARCHAR(2048) NULL;

-- 3) Optional: backfill empty briefs from description (old rows only)
UPDATE `tasks`
SET `instructions` = `description`
WHERE `instructions` IS NULL
  AND `description` IS NOT NULL
  AND `description` != '';

-- Done. Create task with brief / client content / reference should work.
