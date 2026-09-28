-- Phase 3 Security Hardening Migration
-- Revoke UPDATE balance directly from clients
REVOKE UPDATE (saldo) ON public.mitras FROM authenticated;

-- Drop insecure UPDATE policy on transactions
DROP POLICY IF EXISTS "Users can update their own transactions" ON public.transactions;

-- Update RLS policy for transactions: Staff can only insert and select, they should not UPDATE directly via REST
CREATE POLICY "Users can insert transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() = staff_id OR public.is_superadmin());

-- Secure `approve_deposit` RPC
CREATE OR REPLACE FUNCTION public.approve_deposit(p_deposit_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_amount NUMERIC;
    v_mitra_id UUID;
    v_status TEXT;
BEGIN
    IF NOT public.is_superadmin() THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya superadmin yang berhak menjalankan fungsi ini';
    END IF;

    SELECT amount, mitra_id, status INTO v_amount, v_mitra_id, v_status 
    FROM public.deposits WHERE id = p_deposit_id;

    IF v_status != 'pending' THEN
        RETURN FALSE;
    END IF;

    UPDATE public.deposits SET status = 'success', updated_at = NOW() WHERE id = p_deposit_id;
    UPDATE public.mitras SET saldo = saldo + v_amount WHERE id = v_mitra_id;

    RETURN TRUE;
END;
$$;

-- Secure `add_balance` RPC
CREATE OR REPLACE FUNCTION public.add_balance(p_user_id UUID, p_amount NUMERIC)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    IF NOT public.is_superadmin() THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya superadmin yang berhak menambahkan saldo manual';
    END IF;

    UPDATE public.mitras SET saldo = saldo + p_amount 
    WHERE id = (SELECT mitra_id FROM public.users WHERE users.id = p_user_id);
    
    RETURN TRUE;
END;
$$;

-- Secure `transfer_balance` RPC
CREATE OR REPLACE FUNCTION public.transfer_balance(p_from_user_id UUID, p_to_user_id UUID, p_amount NUMERIC)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_from_mitra UUID;
    v_to_mitra UUID;
BEGIN
    -- Check if caller is superadmin OR caller is the exact sender
    IF NOT public.is_superadmin() AND auth.uid() != p_from_user_id THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya pemilik akun atau superadmin yang berhak mentransfer saldo';
    END IF;

    SELECT mitra_id INTO v_from_mitra FROM public.users WHERE id = p_from_user_id;
    SELECT mitra_id INTO v_to_mitra FROM public.users WHERE id = p_to_user_id;

    UPDATE public.mitras SET saldo = saldo - p_amount WHERE id = v_from_mitra;
    UPDATE public.mitras SET saldo = saldo + p_amount WHERE id = v_to_mitra;

    RETURN TRUE;
END;
$$;

-- Secure `fail_and_refund` RPC against double refunding successful transactions
CREATE OR REPLACE FUNCTION public.fail_and_refund(p_transaction_id UUID, p_sn TEXT DEFAULT NULL, p_note TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_harga_modal NUMERIC;
    v_mitra_id UUID;
    v_is_refunded BOOLEAN;
    v_status TEXT;
BEGIN
    SELECT harga_modal, mitra_id, is_refunded, status INTO v_harga_modal, v_mitra_id, v_is_refunded, v_status 
    FROM public.transactions 
    WHERE id = p_transaction_id FOR UPDATE;

    IF v_is_refunded THEN
        RETURN TRUE;
    END IF;

    IF v_status = 'sukses' THEN
        RETURN FALSE;
    END IF;

    UPDATE public.transactions 
    SET status = 'gagal', sn = COALESCE(p_sn, sn), note = COALESCE(p_note, note), is_refunded = true, updated_at = NOW() 
    WHERE id = p_transaction_id;

    UPDATE public.mitras 
    SET saldo = saldo + v_harga_modal 
    WHERE id = v_mitra_id;

    RETURN TRUE;
END;
$$;
