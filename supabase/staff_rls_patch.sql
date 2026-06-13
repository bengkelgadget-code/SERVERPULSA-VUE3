CREATE POLICY "Staff can view their transactions" ON public.transactions FOR SELECT USING (auth.uid() = staff_id);
