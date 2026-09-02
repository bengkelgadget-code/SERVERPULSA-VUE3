CREATE TABLE IF NOT EXISTS public.counter_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mitra_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    tipe TEXT NOT NULL CHECK (tipe IN ('PROVIDER', 'ACC_KATEGORI', 'GAME_KATEGORI')),
    nama TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.counter_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Select counter_categories" ON public.counter_categories FOR SELECT USING (public.is_superadmin() OR mitra_id = public.get_admin_id());
CREATE POLICY "Insert counter_categories" ON public.counter_categories FOR INSERT WITH CHECK (mitra_id = public.get_admin_id());
CREATE POLICY "Update counter_categories" ON public.counter_categories FOR UPDATE USING (mitra_id = public.get_admin_id());
CREATE POLICY "Delete counter_categories" ON public.counter_categories FOR DELETE USING (mitra_id = public.get_admin_id());
