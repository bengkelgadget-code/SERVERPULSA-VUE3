-- Create mitra_pricing table
CREATE TABLE IF NOT EXISTS public.mitra_pricing (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    mitra_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    product_sku TEXT NOT NULL,
    markup_amount NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(mitra_id, product_sku)
);

-- Enable RLS
ALTER TABLE public.mitra_pricing ENABLE ROW LEVEL SECURITY;

-- Policies for mitra_pricing
CREATE POLICY "Mitra pricing is viewable by everyone" ON public.mitra_pricing
    FOR SELECT USING (true);

CREATE POLICY "Mitra can manage their own pricing" ON public.mitra_pricing
    FOR ALL USING (auth.uid() = mitra_id);

CREATE POLICY "Superadmin can manage all pricing" ON public.mitra_pricing
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'superadmin'
        )
    );
