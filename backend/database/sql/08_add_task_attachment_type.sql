-- Add explicit attachment type to separate reference assets and team submissions.
ALTER TABLE task_attachments
  ADD COLUMN attachment_type VARCHAR(32) NOT NULL DEFAULT 'submission' AFTER uploaded_by;

-- Backfill existing records based on uploader role.
UPDATE task_attachments ta
JOIN users u ON u.id = ta.uploaded_by
SET ta.attachment_type = CASE
  WHEN u.role = 'admin' THEN 'asset'
  ELSE 'submission'
END;

