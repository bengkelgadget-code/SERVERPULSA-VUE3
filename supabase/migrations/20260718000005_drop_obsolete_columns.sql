-- Migration to drop obsolete columns from users table
-- SKIP: We need to keep 'saldo' for superadmin.
-- 'admin_id' is tied to old policies. 
-- For safety, we keep them in the DB.

BEGIN;
-- Skipped
COMMIT;
