-- SECURITY PATCH

-- 1. Fix refund_purchase to prevent double refunds
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS is_refunded BOOLEAN DEFAULT FALSE;

CREATE OR REPLACE FUNCTION refund_purchase(p_transaction_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_harga_modal DECIMAL;
  v_is_refunded BOOLEAN;
BEGIN
  -- Get transaction details and lock the row
  SELECT user_id, harga_modal, is_refunded INTO v_user_id, v_harga_modal, v_is_refunded
  FROM public.transactions
  WHERE id = p_transaction_id FOR UPDATE;

  -- Ensure transaction exists
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  -- Only refund if not already refunded
  IF v_is_refunded THEN
    RAISE EXCEPTION 'Transaction has already been refunded';
  END IF;

  -- Return balance to Mitra (using harga_modal)
  UPDATE public.users
  SET saldo = saldo + v_harga_modal
  WHERE id = v_user_id;

  -- Mark as refunded
  UPDATE public.transactions
  SET is_refunded = TRUE,
      status = 'gagal'
  WHERE id = p_transaction_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Clean up dead p_amount parameter from process_purchase
-- We will just update it to remove it if possible, but dropping and recreating might break dependencies. 
-- It's safer to leave p_amount but just not use it.

-- 3. Fix mitra_pricing RLS to prevent public viewing
DROP POLICY IF EXISTS "Mitra pricing is viewable by everyone" ON public.mitra_pricing;
CREATE POLICY "Mitra pricing viewable by authenticated users" ON public.mitra_pricing
  FOR SELECT USING (auth.role() = 'authenticated');
