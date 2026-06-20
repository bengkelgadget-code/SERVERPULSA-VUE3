-- Dashboard Performance Optimization
-- Replaces client-side SUM/COUNT with server-side aggregation

-- Profit summary for admin (staff_ids = admin + their staff)
CREATE OR REPLACE FUNCTION get_profit_summary(p_user_ids UUID[])
RETURNS TABLE(total_profit BIGINT, total_transactions BIGINT, total_pending BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(CASE WHEN t.status = 'sukses' THEN (t.harga_jual - t.harga_modal) ELSE 0 END), 0)::BIGINT AS total_profit,
    COUNT(CASE WHEN t.status = 'sukses' THEN 1 END)::BIGINT AS total_transactions,
    COUNT(CASE WHEN t.status = 'pending' THEN 1 END)::BIGINT AS total_pending
  FROM public.transactions t
  WHERE t.user_id = ANY(p_user_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Deposit summary
CREATE OR REPLACE FUNCTION get_deposit_summary()
RETURNS TABLE(total_pending BIGINT, total_approved BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(CASE WHEN d.status = 'pending' THEN 1 END)::BIGINT AS total_pending,
    COUNT(CASE WHEN d.status = 'success' THEN 1 END)::BIGINT AS total_approved
  FROM public.deposits d;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
