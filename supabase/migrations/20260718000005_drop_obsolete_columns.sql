-- Migration to drop obsolete columns from users table
-- Run this script ONLY after verifying the frontend has been successfully updated and works.

BEGIN;

-- 1. Remove saldo, nama_toko, and admin_id from users table
-- We use IF EXISTS to prevent errors if already dropped
ALTER TABLE public.users 
  DROP COLUMN IF EXISTS saldo,
  DROP COLUMN IF EXISTS nama_toko,
  DROP COLUMN IF EXISTS admin_id;

-- Ensure RLS policies don't reference admin_id anymore
-- If there were policies using admin_id, they should be updated to use mitra_id
-- We already updated the policies in previous migrations!

COMMIT;
