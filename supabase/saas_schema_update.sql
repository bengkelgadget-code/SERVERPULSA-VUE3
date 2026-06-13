-- 1. Add staff_id to transactions table
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES public.users(id);

-- 2. Update process_purchase RPC to deduct from Mitra (admin_id) using harga_modal
CREATE OR REPLACE FUNCTION process_purchase(
  p_user_id UUID,
  p_amount DECIMAL,
  p_sku_code TEXT,
  p_customer_no TEXT,
  p_ref_id TEXT,
  p_harga_modal DECIMAL,
  p_harga_jual DECIMAL
) RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_saldo DECIMAL;
  v_effective_user_id UUID;
  v_caller_role user_role;
  v_admin_id UUID;
BEGIN
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

  -- Check if balance is sufficient based on HARGA MODAL (what Mitra pays Superadmin)
  IF v_saldo >= p_harga_modal THEN
    -- Deduct balance using harga_modal
    UPDATE public.users SET saldo = saldo - p_harga_modal WHERE id = v_effective_user_id;

    -- Insert pending transaction
    INSERT INTO public.transactions (user_id, staff_id, sku_code, customer_no, ref_id, harga_modal, harga_jual, status)
    VALUES (
      v_effective_user_id, -- user_id is the Mitra (who owns the transaction)
      (CASE WHEN v_caller_role = 'staff' THEN p_user_id ELSE NULL END), -- staff_id is the cashier
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

-- 3. Update refund_purchase RPC to return harga_modal
CREATE OR REPLACE FUNCTION refund_purchase(p_transaction_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_harga_modal DECIMAL;
  v_status transaction_status;
BEGIN
  -- Get transaction details and lock the row
  SELECT user_id, harga_modal, status INTO v_user_id, v_harga_modal, v_status
  FROM public.transactions
  WHERE id = p_transaction_id FOR UPDATE;

  -- Only refund if not already successful
  IF v_status = 'sukses' THEN
    RAISE EXCEPTION 'Cannot refund a successful transaction';
  END IF;

  -- Return balance to Mitra (using harga_modal)
  UPDATE public.users
  SET saldo = saldo + v_harga_modal
  WHERE id = v_user_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
