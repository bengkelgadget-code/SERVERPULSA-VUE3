-- BALANCE INTEGRITY PATCH
-- Fixes: double refund, double deposit approval, and balance sync issues

-- 1. Make approve_deposit idempotent (prevent double approval)
CREATE OR REPLACE FUNCTION public.approve_deposit(deposit_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_amount NUMERIC;
  v_status TEXT;
BEGIN
  -- Lock the deposit row and check current status
  SELECT user_id, amount, status INTO v_user_id, v_amount, v_status
  FROM public.deposits
  WHERE id = deposit_id
  FOR UPDATE;

  -- If already approved, do nothing (idempotent)
  IF v_status = 'success' THEN
    RAISE NOTICE 'Deposit already approved';
    RETURN TRUE;
  END IF;

  -- If rejected, don't approve
  IF v_status = 'failed' THEN
    RAISE EXCEPTION 'Deposit has been rejected and cannot be approved';
  END IF;

  -- Add balance to user
  UPDATE public.users SET saldo = saldo + v_amount WHERE id = v_user_id;

  -- Mark deposit as approved
  UPDATE public.deposits SET status = 'success' WHERE id = deposit_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Make refund_purchase idempotent with extra safety
CREATE OR REPLACE FUNCTION public.refund_purchase(p_transaction_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_harga_modal NUMERIC;
  v_is_refunded BOOLEAN;
  v_status TEXT;
BEGIN
  -- Lock the row and get current state
  SELECT user_id, harga_modal, is_refunded, status 
  INTO v_user_id, v_harga_modal, v_is_refunded, v_status
  FROM public.transactions 
  WHERE id = p_transaction_id 
  FOR UPDATE;

  -- Ensure transaction exists
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  -- If already refunded, do nothing (idempotent - don't raise error)
  IF v_is_refunded = TRUE THEN
    RAISE NOTICE 'Transaction already refunded, skipping';
    RETURN TRUE;
  END IF;

  -- Return balance to user
  UPDATE public.users SET saldo = saldo + v_harga_modal WHERE id = v_user_id;

  -- Mark as refunded and set status to gagal
  UPDATE public.transactions 
  SET is_refunded = TRUE, status = 'gagal' 
  WHERE id = p_transaction_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Make add_balance safer (prevent negative saldo)
CREATE OR REPLACE FUNCTION public.add_balance(p_user_id UUID, p_amount NUMERIC)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_saldo NUMERIC;
BEGIN
  -- Lock the user row
  SELECT saldo INTO v_current_saldo FROM public.users WHERE id = p_user_id FOR UPDATE;
  
  IF v_current_saldo IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Prevent saldo from going negative
  IF (v_current_saldo + p_amount) < 0 THEN
    RAISE EXCEPTION 'Insufficient balance. Current: %, Requested change: %', v_current_saldo, p_amount;
  END IF;

  UPDATE public.users SET saldo = saldo + p_amount WHERE id = p_user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Make process_purchase check for duplicate ref_id (prevent double deduction)
CREATE OR REPLACE FUNCTION public.process_purchase(
  p_user_id UUID,
  p_sku_code TEXT,
  p_customer_no TEXT,
  p_ref_id TEXT,
  p_harga_modal NUMERIC,
  p_harga_jual NUMERIC
) RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_saldo NUMERIC;
  v_effective_user_id UUID;
  v_caller_role user_role;
  v_admin_id UUID;
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
  SELECT role, admin_id INTO v_caller_role, v_admin_id FROM public.users WHERE id = p_user_id;

  -- Determine effective user ID for balance deduction
  IF v_caller_role = 'staff' THEN
    IF v_admin_id IS NULL THEN
      RAISE EXCEPTION 'Staff must belong to an admin/mitra to perform transactions';
    END IF;
    v_effective_user_id := v_admin_id;
  ELSE
    v_effective_user_id := p_user_id;
  END IF;

  -- Lock the effective user row for update to prevent race conditions
  SELECT saldo INTO v_saldo FROM public.users WHERE id = v_effective_user_id FOR UPDATE;

  -- Check if balance is sufficient based on HARGA MODAL
  IF v_saldo >= p_harga_modal THEN
    -- Deduct balance using harga_modal
    UPDATE public.users SET saldo = saldo - p_harga_modal WHERE id = v_effective_user_id;

    -- Insert pending transaction
    INSERT INTO public.transactions (user_id, staff_id, sku_code, customer_no, ref_id, harga_modal, harga_jual, status)
    VALUES (
      v_effective_user_id,
      (CASE WHEN v_caller_role = 'staff' THEN p_user_id ELSE NULL END),
      p_sku_code, 
      p_customer_no, 
      p_ref_id, 
      p_harga_modal, 
      p_harga_jual, 
      'pending'
    )
    RETURNING id INTO v_transaction_id;

    RETURN v_transaction_id;
  ELSE
    -- Insufficient balance
    RAISE EXCEPTION 'Saldo Mitra tidak mencukupi';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Make transfer_balance safer
CREATE OR REPLACE FUNCTION public.transfer_balance(
  p_from_user_id UUID,
  p_to_user_id UUID,
  p_amount NUMERIC
) RETURNS BOOLEAN AS $$
DECLARE
  v_from_saldo NUMERIC;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Transfer amount must be positive';
  END IF;

  -- Lock the source user row
  SELECT saldo INTO v_from_saldo FROM public.users WHERE id = p_from_user_id FOR UPDATE;
  
  IF v_from_saldo IS NULL THEN
    RAISE EXCEPTION 'Source user not found';
  END IF;

  IF v_from_saldo < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance for transfer';
  END IF;

  -- Deduct from source
  UPDATE public.users SET saldo = saldo - p_amount WHERE id = p_from_user_id;
  
  -- Add to target
  UPDATE public.users SET saldo = saldo + p_amount WHERE id = p_to_user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
