-- FlowPilot client test account seed (manual SQL option)
-- Username: rnsxtm6a
-- Password: 6MrEBruk7%9tfN
--
-- NOTE:
-- This script seeds client + project only.
-- For the login user/password hash, run: php artisan db:seed
-- (DatabaseSeeder creates/updates the client login account safely).

START TRANSACTION;

INSERT INTO clients (name, company, email, phone, notes, created_at, updated_at)
VALUES (
  'Hilal Baby Cycle',
  'Hilal Baby Cycle',
  'client.hilal@flowpilot.local',
  '+92-300-0000000',
  'Client test account seeded for portal QA.',
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  company = VALUES(company),
  phone = VALUES(phone),
  notes = VALUES(notes),
  updated_at = NOW();

SET @client_id := (SELECT id FROM clients WHERE email = 'client.hilal@flowpilot.local' LIMIT 1);

INSERT INTO projects (client_id, name, description, status, priority, deadline, created_at, updated_at)
VALUES (
  @client_id,
  'Hilal Baby Cycle Project',
  'Client portal QA project',
  'active',
  'medium',
  NULL,
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  status = VALUES(status),
  priority = VALUES(priority),
  updated_at = NOW();

COMMIT;
