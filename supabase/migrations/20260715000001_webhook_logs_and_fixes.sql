-- 1. Webhook Logs Table
CREATE TABLE IF NOT EXISTS webhook_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ref_id TEXT,
    event_type TEXT,
    payload JSONB NOT NULL,
    signature TEXT,
    processed BOOLEAN DEFAULT false,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. UNIQUE constraint on transactions.ref_id to prevent duplicates
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS unique_ref_id;
ALTER TABLE transactions ADD CONSTRAINT unique_ref_id UNIQUE (ref_id);

-- 3. Atomic fail_and_refund RPC
CREATE OR REPLACE FUNCTION fail_and_refund(
  p_transaction_id UUID,
  p_sn TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_harga_modal NUMERIC;
  v_is_refunded BOOLEAN;
  v_status TEXT;
BEGIN
  -- Get current state with row lock
  SELECT user_id, harga_modal, is_refunded, status 
  INTO v_user_id, v_harga_modal, v_is_refunded, v_status
  FROM public.transactions 
  WHERE id = p_transaction_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  -- If it's already failed and refunded, just update SN/note and return
  IF v_status = 'gagal' AND v_is_refunded = TRUE THEN
    UPDATE public.transactions 
    SET sn = COALESCE(p_sn, sn), note = COALESCE(p_note, note), updated_at = now()
    WHERE id = p_transaction_id;
    RETURN TRUE;
  END IF;

  -- Perform refund (return saldo)
  UPDATE public.users SET saldo = saldo + v_harga_modal WHERE id = v_user_id;

  -- Update transaction to gagal
  UPDATE public.transactions 
  SET 
    status = 'gagal', 
    is_refunded = TRUE, 
    sn = COALESCE(p_sn, sn), 
    note = COALESCE(p_note, note),
    updated_at = now()
  WHERE id = p_transaction_id;

  RETURN TRUE;
END;
$$;

-- 4. Update process_purchase to accept and insert product_name
DROP FUNCTION IF EXISTS process_purchase(UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC);

CREATE OR REPLACE FUNCTION process_purchase(
  p_user_id UUID,
  p_sku_code TEXT,
  p_customer_no TEXT,
  p_ref_id TEXT,
  p_harga_modal NUMERIC,
  p_harga_jual NUMERIC,
  p_product_name TEXT DEFAULT NULL
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
    INSERT INTO public.transactions (user_id, staff_id, sku_code, customer_no, ref_id, harga_modal, harga_jual, status, product_name)
    VALUES (
      v_effective_user_id,
      (CASE WHEN v_caller_role = 'staff' THEN p_user_id ELSE NULL END),
      p_sku_code, 
      p_customer_no, 
      p_ref_id, 
      p_harga_modal, 
      p_harga_jual, 
      'pending',
      p_product_name
    ) RETURNING id INTO v_transaction_id;

    RETURN v_transaction_id;
  ELSE
    RAISE EXCEPTION 'Insufficient balance';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Add cron job for auto-checking pending transactions every 30 minutes
DO $$
BEGIN
  -- Unschedule if exists to avoid error
  PERFORM cron.unschedule('check-stale-pending-trx');
EXCEPTION WHEN OTHERS THEN
  -- Ignore if it doesn't exist
END $$;

SELECT cron.schedule(
  'check-stale-pending-trx',
  '*/30 * * * *',
  $$
    SELECT net.http_post(
      url:='https://slkdoaeacjxgkviicaot.supabase.co/functions/v1/api/check-stale-pending',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body:='{}'::jsonb
    )
  $$
);
