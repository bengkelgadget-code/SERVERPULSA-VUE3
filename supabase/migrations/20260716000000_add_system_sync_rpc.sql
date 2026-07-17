-- 1. Create a safe place to store system settings
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Allow everyone to read settings (for frontend to fetch last sync time easily)
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all" ON public.system_settings;
CREATE POLICY "Enable read access for all" ON public.system_settings FOR SELECT USING (true);

-- 3. Create RPC to set sync time (bypasses RLS, used by Edge Function)
CREATE OR REPLACE FUNCTION set_last_sync_time(p_time TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.system_settings (key, value, updated_at)
  VALUES ('LAST_SYNC_TIME', p_time, NOW())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create RPC to get sync time (bypasses RLS, used by Frontend Vue)
CREATE OR REPLACE FUNCTION get_last_sync_time()
RETURNS TEXT AS $$
DECLARE
  v_time TEXT;
BEGIN
  SELECT value INTO v_time FROM public.system_settings WHERE key = 'LAST_SYNC_TIME';
  RETURN v_time;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
