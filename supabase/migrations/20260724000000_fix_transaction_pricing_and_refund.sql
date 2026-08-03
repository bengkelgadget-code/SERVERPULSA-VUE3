-- Fix process_transaction and fail_and_refund to use harga_jual instead of harga_modal for Mitra balances

BEGIN;

-- 1. UPDATE process_transaction to deduct harga_jual
CREATE OR REPLACE FUNCTION public.process_transaction(
  p_user_id UUID,
  p_sku_code TEXT,
  p_customer_no TEXT,
  p_ref_id TEXT,
  p_harga_modal NUMERIC,
  p_harga_jual NUMERIC,
  p_product_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_saldo NUMERIC;
  v_transaction_id UUID;
  v_existing_trx UUID;
  v_caller_role TEXT;
  v_mitra_id UUID;
  v_effective_user_id UUID;
BEGIN
  -- Prevent duplicate transactions
  SELECT id INTO v_existing_trx FROM public.transactions WHERE ref_id = p_ref_id LIMIT 1;
  IF v_existing_trx IS NOT NULL THEN
    RAISE EXCEPTION 'Duplicate transaction with ref_id: %', p_ref_id;
  END IF;

  -- Get user details
  SELECT role, mitra_id INTO v_caller_role, v_mitra_id FROM public.users WHERE id = p_user_id;

  -- Ensure user belongs to a mitra
  IF v_mitra_id IS NULL THEN
    RAISE EXCEPTION 'User must belong to a mitra to perform transactions';
  END IF;

  -- Find the admin of this mitra to act as effective_user_id for legacy compatibility
  SELECT id INTO v_effective_user_id FROM public.users WHERE mitra_id = v_mitra_id AND role = 'admin' LIMIT 1;
  IF v_effective_user_id IS NULL THEN
    v_effective_user_id := p_user_id;
  END IF;

  -- Lock the mitra row for update to prevent race conditions
  SELECT saldo INTO v_saldo FROM public.mitras WHERE id = v_mitra_id FOR UPDATE;

  -- Check if balance is sufficient based on HARGA JUAL
  IF v_saldo >= p_harga_jual THEN
    -- Deduct balance using harga_jual from mitras table
    UPDATE public.mitras SET saldo = saldo - p_harga_jual WHERE id = v_mitra_id;

    -- Insert pending transaction
    INSERT INTO public.transactions (user_id, staff_id, sku_code, customer_no, ref_id, harga_modal, harga_jual, status, product_name, mitra_id)
    VALUES (
      v_effective_user_id,
      (CASE WHEN v_caller_role = 'staff' THEN p_user_id ELSE NULL END),
      p_sku_code, 
      p_customer_no, 
      p_ref_id, 
      p_harga_modal, 
      p_harga_jual, 
      'pending',
      p_product_name,
      v_mitra_id
    ) RETURNING id INTO v_transaction_id;

    RETURN v_transaction_id;
  ELSE
    RAISE EXCEPTION 'Insufficient balance in Mitra account';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. UPDATE fail_and_refund to refund harga_jual
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
  SELECT user_id, mitra_id, harga_jual, is_refunded INTO v_user_id, v_mitra_id, v_harga_jual, v_is_refunded
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

  -- Mark as refunded
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
