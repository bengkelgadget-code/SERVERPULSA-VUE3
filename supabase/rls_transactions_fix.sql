-- Fix RLS policies to ensure everyone sees the correct transactions

-- 1. Create a helper function to get admin_id securely
CREATE OR REPLACE FUNCTION public.get_admin_id() RETURNS UUID AS $$
DECLARE
  v_admin_id UUID;
  v_role TEXT;
BEGIN
  SELECT role, admin_id INTO v_role, v_admin_id FROM public.users WHERE id = auth.uid();
  IF v_role = 'staff' THEN
    RETURN v_admin_id;
  ELSE
    RETURN auth.uid();
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create a helper function to check superadmin securely
CREATE OR REPLACE FUNCTION public.is_superadmin() RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
  RETURN v_role = 'superadmin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Drop existing policies
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Staff can view their transactions" ON public.transactions;
DROP POLICY IF EXISTS "Superadmin can view all transactions" ON public.transactions;
DROP POLICY IF EXISTS "View transactions policy" ON public.transactions;

-- 4. Create a unified policy for SELECT
-- Superadmin sees all
-- Mitra sees their own (user_id = auth.uid())
-- Staff sees their Mitra's (user_id = admin_id)
CREATE POLICY "View transactions policy" ON public.transactions FOR SELECT 
USING (
  public.is_superadmin() 
  OR user_id = public.get_admin_id()
);
