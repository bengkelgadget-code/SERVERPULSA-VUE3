-- Migration to add is_refunded and recreate refund_purchase
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS is_refunded BOOLEAN DEFAULT FALSE;

-- 3. Update refund_purchase RPC to return harga_modal
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
