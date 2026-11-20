-- Kembalikan EXECUTE untuk authenticated pada 6 RPC yang dipanggil langsung oleh app,
-- yang ikut tercabut di hardening gelombang 2 (20261102150000, daftar ops_private.auth_revoke_backup).
-- Dua fungsi keuangan diperketat dulu sebelum dibuka kembali. anon tetap tidak punya EXECUTE.
--
-- 1. merge_*_dry_run (4 fungsi, CRM > gabung lead duplikat)
--    Sudah memanggil _lead_merge_assert_org_access (auth.uid() harus anggota org), sama seperti
--    pasangan *_execute yang tetap terbuka. Tanpa grant, tombol pratinjau merge gagal 42501.
--
-- 2. confirm_income_bank_deposit (verifikasi transfer pembayaran piutang)
--    Sudah cek owner/admin lewat auth.uid(). Diperketat: p_confirmed_by dari pemanggil tidak lagi
--    bisa menimpa user yang login, sehingga jejak "dikonfirmasi oleh" tidak bisa dipalsukan.
--    service_role (tanpa auth.uid()) tetap bisa mengisi p_confirmed_by.
--
-- 3. delete_bank_transfer_by_income_transaction (hapus income hasil transfer antar bank)
--    Org diambil dari profiles.active_organization_id, yang bisa diubah sendiri oleh user
--    (policy profiles_update_own tanpa WITH CHECK). Diperketat: org aktif wajib termasuk
--    user_organization_ids(), sama dengan policy DELETE income_transactions.

CREATE OR REPLACE FUNCTION public.confirm_income_bank_deposit(p_income_id uuid, p_deposit_source text DEFAULT 'manual_verification'::text, p_confirmed_by uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_income public.income_transactions%ROWTYPE;
  v_actor uuid;
  v_source text;
  v_new_status text;
BEGIN
  -- User yang login selalu tercatat sebagai pengonfirmasi; p_confirmed_by hanya untuk service_role.
  v_actor := COALESCE(auth.uid(), p_confirmed_by);
  v_source := COALESCE(NULLIF(btrim(p_deposit_source), ''), 'manual_verification');

  SELECT * INTO v_income
  FROM public.income_transactions
  WHERE id = p_income_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'income_transaction_not_found';
  END IF;

  IF v_income.status = 'cancelled' THEN
    RAISE EXCEPTION 'income_transaction_cancelled';
  END IF;

  IF NOT public.user_is_org_owner_or_admin(v_income.organization_id) THEN
    RAISE EXCEPTION 'income_deposit_confirm_forbidden';
  END IF;

  IF v_income.deposit_confirmed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_confirmed', true,
      'income_id', v_income.id,
      'status', v_income.status
    );
  END IF;

  IF v_income.bank_account_id IS NULL THEN
    RAISE EXCEPTION 'income_bank_account_required';
  END IF;

  v_new_status := public.income_status_after_deposit(
    v_income.income_type_id,
    v_income.category_id,
    v_income.bank_account_id
  );

  UPDATE public.income_transactions
  SET
    deposit_confirmed_at = now(),
    deposit_confirmed_by = v_actor,
    deposit_source = v_source,
    status = v_new_status,
    updated_at = now()
  WHERE id = v_income.id;

  PERFORM public.credit_income_bank_deposit(
    v_income.id,
    v_income.bank_account_id,
    v_income.organization_id,
    v_income.amount,
    COALESCE(v_actor, v_income.created_by),
    'Income deposit confirmed'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'income_id', v_income.id,
    'status', v_new_status
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_bank_transfer_by_income_transaction(p_income_transaction_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_org_id uuid;
  j RECORD;
  v_from_before NUMERIC(15, 2);
  v_to_before NUMERIC(15, 2);
  v_total_out NUMERIC(15, 2);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.active_organization_id INTO v_org_id
  FROM public.profiles p
  WHERE p.user_id = v_uid
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No active organization';
  END IF;

  -- active_organization_id bisa diubah sendiri oleh user; pastikan benar anggota org itu.
  IF v_org_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'Not a member of active organization';
  END IF;

  SELECT * INTO j
  FROM public.bank_transfer_journals btj
  WHERE btj.income_transaction_id = p_income_transaction_id
    AND btj.organization_id = v_org_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_BANK_TRANSFER_INCOME';
  END IF;

  v_total_out := j.amount + j.fee;

  SELECT b.balance INTO v_from_before
  FROM public.bank_account_balances b
  WHERE b.bank_account_id = j.from_bank_account_id
    AND b.organization_id = v_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SOURCE_BALANCE_ROW_MISSING';
  END IF;

  SELECT b.balance INTO v_to_before
  FROM public.bank_account_balances b
  WHERE b.bank_account_id = j.to_bank_account_id
    AND b.organization_id = v_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DEST_BALANCE_ROW_MISSING';
  END IF;

  IF v_to_before < j.amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_DEST_TO_DELETE_TRANSFER';
  END IF;

  UPDATE public.bank_account_balances
  SET balance = v_from_before + v_total_out,
      updated_at = NOW()
  WHERE bank_account_id = j.from_bank_account_id
    AND organization_id = v_org_id;

  INSERT INTO public.bank_account_balance_history (
    bank_account_id,
    organization_id,
    transaction_type,
    transaction_id,
    amount,
    balance_before,
    balance_after,
    description,
    created_by
  ) VALUES (
    j.from_bank_account_id,
    v_org_id,
    'manual_adjustment',
    NULL,
    v_total_out,
    v_from_before,
    v_from_before + v_total_out,
    'Revert bank transfer (delete paired income/expense)',
    v_uid
  );

  UPDATE public.bank_account_balances
  SET balance = v_to_before - j.amount,
      updated_at = NOW()
  WHERE bank_account_id = j.to_bank_account_id
    AND organization_id = v_org_id;

  INSERT INTO public.bank_account_balance_history (
    bank_account_id,
    organization_id,
    transaction_type,
    transaction_id,
    amount,
    balance_before,
    balance_after,
    description,
    created_by
  ) VALUES (
    j.to_bank_account_id,
    v_org_id,
    'manual_adjustment',
    NULL,
    -j.amount,
    v_to_before,
    v_to_before - j.amount,
    'Revert bank transfer (remove credit to destination)',
    v_uid
  );

  DELETE FROM public.bank_transfer_journals
  WHERE id = j.id;

  DELETE FROM public.expenses
  WHERE id = j.expense_id;

  DELETE FROM public.income_transactions
  WHERE id = p_income_transaction_id;

  RETURN json_build_object('ok', true);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.confirm_income_bank_deposit(uuid,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_income_bank_deposit(uuid,text,uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.delete_bank_transfer_by_income_transaction(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_bank_transfer_by_income_transaction(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.merge_checkout_identity_bridge_dry_run(uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_checkout_identity_bridge_dry_run(uuid,uuid,uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.merge_customer_lead_duplicates_dry_run(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_customer_lead_duplicates_dry_run(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.merge_identity_graph_leads_dry_run(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_identity_graph_leads_dry_run(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.merge_typo_email_leads_dry_run(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_typo_email_leads_dry_run(uuid) TO authenticated, service_role;
