CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT role FROM public.users WHERE id = auth.uid()) = 'superadmin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS just in case it was off and we are relying on defaults
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies on products to avoid conflicts
DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.products;
DROP POLICY IF EXISTS "Superadmin and admin can view all products" ON public.products;
DROP POLICY IF EXISTS "Anyone can view active products" ON public.products;
DROP POLICY IF EXISTS "Enable read access for all" ON public.products;

-- Create unified policies:
-- 1. Superadmin and Admin Mitra can see ALL products (Active & Inactive)
-- 2. Staff / Public can only see ACTIVE products
CREATE POLICY "Superadmin and Admin can see all products" 
ON public.products 
FOR SELECT 
USING ( public.is_superadmin() OR public.is_admin() );

CREATE POLICY "Public and Staff can only see active products" 
ON public.products 
FOR SELECT 
USING ( is_active = true );

-- Ensure Superadmin and Admin can update products
DROP POLICY IF EXISTS "Superadmin can update products" ON public.products;
CREATE POLICY "Superadmin can update products" 
ON public.products 
FOR UPDATE 
USING ( public.is_superadmin() );
