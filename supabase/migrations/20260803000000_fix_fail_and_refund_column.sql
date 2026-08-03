-- Fix column name from catatan to note in fail_and_refund function
-- This solves transaction failures not updating to 'gagal' in the database and causing repeated notifications

BEGIN;

CREATE OR REPLACE FUNCTION public.fail_and_refund(
  p_transaction_id UUID,
  p_sn TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_mitra_id UUID;
  v_harga_jual DECIMAL;
  v_is_refunded BOOLEAN;
BEGIN
  -- Get transaction details and lock the row
  SELECT user_id, mitra_id, harga_jual, COALESCE(is_refunded, false) INTO v_user_id, v_mitra_id, v_harga_jual, v_is_refunded
  FROM public.transactions
  WHERE id = p_transaction_id FOR UPDATE;

  -- Ensure transaction exists
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  -- Only refund if not already refunded
  IF v_is_refunded THEN
    -- Idempotent: return true without raising exception so webhook/check-status doesn't crash
    UPDATE public.transactions
    SET status = 'gagal',
        sn = COALESCE(p_sn, sn),
        note = COALESCE(p_note, note),
        updated_at = now()
    WHERE id = p_transaction_id;
    RETURN TRUE;
  END IF;

  -- Return balance to Mitra (using harga_jual)
  IF v_mitra_id IS NOT NULL THEN
    UPDATE public.mitras
    SET saldo = saldo + v_harga_jual
    WHERE id = v_mitra_id;
  ELSE
    -- Fallback for legacy transactions that might not have a mitra_id
    UPDATE public.users
    SET saldo = saldo + v_harga_jual
    WHERE id = v_user_id;
  END IF;

  -- Mark as refunded and update status with correct column name 'note'
  UPDATE public.transactions
  SET is_refunded = TRUE,
      status = 'gagal',
      sn = p_sn,
      note = p_note,
      updated_at = now()
  WHERE id = p_transaction_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
