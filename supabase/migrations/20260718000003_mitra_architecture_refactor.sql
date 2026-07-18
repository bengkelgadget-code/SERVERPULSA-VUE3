-- 20260718000003_mitra_architecture_refactor.sql

BEGIN;

-- 1. Create mitras table
CREATE TABLE IF NOT EXISTS public.mitras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama_mitra VARCHAR NOT NULL,
    alamat TEXT,
    saldo DECIMAL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add mitra_id to users, transactions, and deposits
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS mitra_id UUID REFERENCES public.mitras(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS mitra_id UUID REFERENCES public.mitras(id) ON DELETE CASCADE;
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS mitra_id UUID REFERENCES public.mitras(id) ON DELETE CASCADE;

-- 3. Data Migration: Consolidate balances into Superadmin, then create Mitras and link users
DO $$
DECLARE
    r RECORD;
    v_new_mitra_id UUID;
    v_superadmin_id UUID;
    v_total_admin_saldo DECIMAL;
BEGIN
    -- A. Find the superadmin
    SELECT id INTO v_superadmin_id FROM public.users WHERE role = 'superadmin' LIMIT 1;
    
    IF v_superadmin_id IS NOT NULL THEN
        -- Calculate total saldo from all admins
        SELECT COALESCE(SUM(saldo), 0) INTO v_total_admin_saldo FROM public.users WHERE role = 'admin';
        
        -- Add it to superadmin
        UPDATE public.users SET saldo = saldo + v_total_admin_saldo WHERE id = v_superadmin_id;
        
        -- Zero out admin balances
        UPDATE public.users SET saldo = 0 WHERE role = 'admin';
    END IF;

    -- B. Loop through all admin users
    FOR r IN SELECT id, nama_toko FROM public.users WHERE role = 'admin' LOOP
        -- Insert a new mitra for this admin (saldo is 0 since we consolidated)
        INSERT INTO public.mitras (nama_mitra, saldo)
        VALUES (COALESCE(r.nama_toko, 'Mitra Baru'), 0)
        RETURNING id INTO v_new_mitra_id;
        
        -- Link the admin to this new mitra
        UPDATE public.users SET mitra_id = v_new_mitra_id WHERE id = r.id;
        
        -- Link all staff of this admin to the same mitra
        UPDATE public.users SET mitra_id = v_new_mitra_id WHERE admin_id = r.id AND role = 'staff';
        
        -- Link transactions and deposits for this admin/staff to the new mitra
        UPDATE public.transactions SET mitra_id = v_new_mitra_id WHERE user_id = r.id OR staff_id = r.id;
        UPDATE public.deposits SET mitra_id = v_new_mitra_id WHERE user_id = r.id;
    END LOOP;
END $$;

-- 4. Enable Realtime for mitras table
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.mitras;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
ALTER TABLE public.mitras REPLICA IDENTITY FULL;

-- 5. RLS for mitras table
ALTER TABLE public.mitras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Mitras are viewable by superadmin or own users" ON public.mitras;
CREATE POLICY "Mitras are viewable by superadmin or own users"
ON public.mitras FOR SELECT
USING (public.is_superadmin() OR id = (SELECT mitra_id FROM public.users WHERE users.id = auth.uid()));

DROP POLICY IF EXISTS "Mitras are updatable by superadmin or admin" ON public.mitras;
CREATE POLICY "Mitras are updatable by superadmin or admin"
ON public.mitras FOR UPDATE
USING (public.is_superadmin() OR (id = (SELECT mitra_id FROM public.users WHERE users.id = auth.uid()) AND (SELECT role FROM public.users WHERE users.id = auth.uid()) = 'admin'));

DROP POLICY IF EXISTS "Superadmin can insert mitras" ON public.mitras;
CREATE POLICY "Superadmin can insert mitras" ON public.mitras FOR INSERT WITH CHECK (public.is_superadmin());

DROP POLICY IF EXISTS "Superadmin can delete mitras" ON public.mitras;
CREATE POLICY "Superadmin can delete mitras" ON public.mitras FOR DELETE USING (public.is_superadmin());

COMMIT;
