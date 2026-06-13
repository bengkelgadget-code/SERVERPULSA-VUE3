-- Create an RLS policy that allows superadmin to view ALL transactions
CREATE OR REPLACE FUNCTION auth.role() RETURNS text AS $$
  SELECT current_setting('request.jwt.claims', true)::json->>'role';
$$ LANGUAGE sql STABLE;

-- However, we don't have role in JWT by default in Supabase Auth, 
-- role is stored in public.users table.
-- Let's use a function to check if the current user is a superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin() RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
  RETURN v_role = 'superadmin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policy for Superadmin
DROP POLICY IF EXISTS "Superadmin can view all transactions" ON public.transactions;
CREATE POLICY "Superadmin can view all transactions" ON public.transactions FOR SELECT USING (public.is_superadmin());

-- Make sure admin/mitra can view their own transactions, and staff can view transactions where staff_id matches
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
CREATE POLICY "Users can view their own transactions" ON public.transactions FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Staff can view their transactions" ON public.transactions;
CREATE POLICY "Staff can view their transactions" ON public.transactions FOR SELECT USING (staff_id = auth.uid());
