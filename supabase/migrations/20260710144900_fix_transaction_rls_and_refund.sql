-- 1. Create a unified policy for SELECT (if not exists)
-- This was already done in previous migrations, but we ensure the UPDATE policy is there.

-- 2. Add UPDATE policy for transactions
-- Only service_role and users who own the transaction can update it
DROP POLICY IF EXISTS "Users can update their own transactions" ON public.transactions;
CREATE POLICY "Users can update their own transactions" 
  ON public.transactions FOR UPDATE 
  USING (user_id = auth.uid() OR staff_id = auth.uid() OR public.is_superadmin());

-- 3. Ensure refund_purchase is idempotent and safe (does not raise exception if already refunded)
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
    -- Idempotent: return true without raising exception so webhook/check-status doesn't crash
    RETURN TRUE;
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
