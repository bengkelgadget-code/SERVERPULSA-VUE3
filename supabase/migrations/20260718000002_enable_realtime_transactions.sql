-- ============================================================
-- Enable Supabase Realtime for transactions and users tables
-- ============================================================

-- 1. Add transactions table to supabase_realtime publication
-- Without this, NO realtime events will be broadcast for transaction changes
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
EXCEPTION WHEN duplicate_object THEN
  -- Already added, ignore
  NULL;
END $$;

-- 2. Add users table to supabase_realtime publication
-- This enables realtime saldo/balance updates
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
EXCEPTION WHEN duplicate_object THEN
  -- Already added, ignore
  NULL;
END $$;

-- 3. Set REPLICA IDENTITY FULL on transactions
-- Required for filtered realtime subscriptions (e.g. filter: 'user_id=eq.xxx')
-- Without this, Postgres only sends the primary key, and Supabase can't match filters
ALTER TABLE public.transactions REPLICA IDENTITY FULL;

-- 4. Set REPLICA IDENTITY FULL on users
-- Required for filtered realtime subscriptions (e.g. filter: 'id=eq.xxx')
ALTER TABLE public.users REPLICA IDENTITY FULL;
