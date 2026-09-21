BEGIN;

-- 0. Set any existing negative balances to 0 so the constraint doesn't fail
UPDATE public.mitras SET saldo = 0 WHERE saldo < 0;
UPDATE public.users SET saldo = 0 WHERE saldo < 0;

-- 1. Tambahkan constraint keamanan agar saldo tidak pernah minus di level database
DO $$ BEGIN ALTER TABLE public.mitras ADD CONSTRAINT check_saldo_positive CHECK (saldo >= 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.users ADD CONSTRAINT check_saldo_positive CHECK (saldo >= 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Perbaiki process_purchase agar memotong saldo Mitra sesuai Harga Jual (sehingga Superadmin mendapatkan profit)
CREATE OR REPLACE FUNCTION public.process_purchase(
  p_user_id UUID,
  p_sku_code TEXT,
  p_customer_no TEXT,
  p_ref_id TEXT,
  p_harga_modal NUMERIC,
  p_harga_jual NUMERIC,
  p_product_name TEXT DEFAULT NULL
) RETURNS UUID AS $$ DECLARE
  v_transaction_id UUID;
  v_saldo NUMERIC;
  v_effective_user_id UUID;
  v_caller_role TEXT;
  v_mitra_id UUID;
  v_existing_trx UUID;
BEGIN
  -- Check for duplicate ref_id (prevent double deduction)
  SELECT id INTO v_existing_trx FROM public.transactions 
  WHERE ref_id = p_ref_id 
  LIMIT 1;
  
  IF v_existing_trx IS NOT NULL THEN
    RAISE EXCEPTION 'Duplicate transaction with ref_id: %', p_ref_id;
  END IF;

  -- Get user details
  SELECT role, mitra_id INTO v_caller_role, v_mitra_id FROM public.users WHERE id = p_user_id;

  IF v_mitra_id IS NOT NULL THEN
    SELECT id INTO v_effective_user_id FROM public.users WHERE mitra_id = v_mitra_id AND role = 'admin' LIMIT 1;
  END IF;

  IF v_effective_user_id IS NULL THEN
    v_effective_user_id := p_user_id;
  END IF;

  IF v_mitra_id IS NOT NULL THEN
    -- Lock the mitra row for update
    SELECT saldo INTO v_saldo FROM public.mitras WHERE id = v_mitra_id FOR UPDATE;

    -- Check if balance is sufficient based on HARGA JUAL
    IF v_saldo >= p_harga_jual THEN
      UPDATE public.mitras SET saldo = saldo - p_harga_jual WHERE id = v_mitra_id;
    ELSE
      RAISE EXCEPTION 'Saldo Mitra tidak mencukupi';
    END IF;
  ELSE
    -- Fallback for superadmin or users without mitra
    SELECT saldo INTO v_saldo FROM public.users WHERE id = p_user_id FOR UPDATE;
    IF v_saldo >= p_harga_jual THEN
      UPDATE public.users SET saldo = saldo - p_harga_jual WHERE id = p_user_id;
    ELSE
      RAISE EXCEPTION 'Saldo User tidak mencukupi';
    END IF;
  END IF;

  -- Insert pending transaction WITH mitra_id
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Perbaiki fail_and_refund agar mengembalikan saldo sejumlah Harga Jual (karena yang dipotong adalah harga jual)
CREATE OR REPLACE FUNCTION public.fail_and_refund(
  p_transaction_id UUID,
  p_sn TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$ DECLARE
  v_user_id UUID;
  v_mitra_id UUID;
  v_harga_jual NUMERIC;
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
    -- Idempotent: just update status metadata, don't refund again
    UPDATE public.transactions
    SET status = 'gagal',
        sn = COALESCE(p_sn, sn),
        note = COALESCE(p_note, note),
        updated_at = now()
    WHERE id = p_transaction_id;
    RETURN TRUE;
  END IF;

  -- Return balance to Mitra (using harga_jual = what was originally deducted)
  IF v_mitra_id IS NOT NULL THEN
    UPDATE public.mitras
    SET saldo = saldo + v_harga_jual
    WHERE id = v_mitra_id;
  ELSE
    -- Fallback for legacy transactions without mitra_id
    UPDATE public.users
    SET saldo = saldo + v_harga_jual
    WHERE id = v_user_id;
  END IF;

  -- Mark as refunded and update status
  UPDATE public.transactions
  SET is_refunded = TRUE,
      status = 'gagal',
      sn = COALESCE(p_sn, sn),
      note = COALESCE(p_note, note),
      updated_at = now()
  WHERE id = p_transaction_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
