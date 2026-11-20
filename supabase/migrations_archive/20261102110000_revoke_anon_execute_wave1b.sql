-- Gelombang 1b. Jalankan file ini di SQL editor. Jangan jalankan file rollback.
-- Bagian pertama mengulang penutupan gelombang 1, supaya rollback yang sudah
-- terlanjur dijalankan tidak meninggalkan EXECUTE untuk anon.
-- Bagian kedua menambah pemeriksaan pemanggil dan menutup mutasi bank serta
-- fungsi yang membaca rahasia vault.

-- ---------------------------------------------------------------------------
-- Ulangi gelombang 1
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.apply_xendit_qris_settlement(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_xendit_qris_settlement(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.apply_xendit_va_settlement(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_xendit_va_settlement(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.apply_brick_va_settlement(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_brick_va_settlement(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.apply_xendit_gateway_withdrawal_settlement(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_xendit_gateway_withdrawal_settlement(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.finalize_purchase_request_gateway_payment(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_purchase_request_gateway_payment(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.finalize_payroll_run_thp_expense(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_payroll_run_thp_expense(uuid, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.apply_attendance_auto_checkout(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_attendance_auto_checkout(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.fetch_google_ads_pending_conversion_batch(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_google_ads_pending_conversion_batch(integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.claim_daily_task_assignment_push_queue(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_task_assignment_push_queue(uuid, integer, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.claim_daily_task_completion_push_queue(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_task_completion_push_queue(uuid, integer, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.claim_due_scheduled_posts(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_scheduled_posts(integer, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.claim_google_contacts_sync_jobs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_google_contacts_sync_jobs(integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.claim_resume_publishing_posts(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_resume_publishing_posts(integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.claim_social_media_production_push_queue(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_social_media_production_push_queue(uuid, integer, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.claim_task_step_comment_push_queue(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_task_step_comment_push_queue(uuid, integer, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.credit_income_bank_deposit(uuid, uuid, uuid, numeric, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_store_checkout_income(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._purge_organization_rows(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_social_media_load_test_rows() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._apply_plan_modules(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._regenerate_plan_features_for_plan(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_performance_bonus(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_late_arrival_penalties(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Pembatalan pemasukan: hanya owner atau admin organisasi itu
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_income_for_payment_rejection(p_sales_activity_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF p_sales_activity_payment_id IS NULL THEN
    RETURN;
  END IF;

  SELECT it.organization_id
  INTO v_org
  FROM public.income_transactions it
  WHERE it.sales_activity_payment_id = p_sales_activity_payment_id
  LIMIT 1;

  IF v_org IS NOT NULL AND NOT public.user_is_org_owner_or_admin(v_org) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.income_transactions
  SET status = 'cancelled', updated_at = now()
  WHERE sales_activity_payment_id = p_sales_activity_payment_id
    AND deposit_confirmed_at IS NULL
    AND status IN ('pending', 'deposited');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_income_for_payment_rejection(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_income_for_payment_rejection(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Perubahan langganan jatuh tempo.
-- Cron (bukan anon/authenticated) tetap memproses semua organisasi.
-- User yang sudah login hanya memproses organisasi yang boleh ia kelola.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.apply_due_subscription_change_requests()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.subscription_change_requests%ROWTYPE;
  v_applied integer := 0;
  v_employees integer;
  v_roster integer;
  v_omni_target integer;
  v_lm_target boolean;
  v_pos_target integer;
  v_pos_addon_target boolean;
  v_outlet_count integer;
  v_omni_json jsonb;
  v_lm_json jsonb;
  v_pos_json jsonb;
BEGIN
  IF current_user IN ('anon', 'authenticated') AND auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  FOR v_row IN
    SELECT *
    FROM public.subscription_change_requests
    WHERE status = 'pending'
      AND scheduled_date <= now()
      AND (
        current_user NOT IN ('anon', 'authenticated')
        OR public.user_can_manage_subscription(organization_id)
      )
    ORDER BY scheduled_date ASC
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      v_employees := public.count_active_employees_for_org(v_row.organization_id);
      IF v_employees > v_row.target_member_count THEN
        RAISE EXCEPTION 'active employees (%) exceed target member count (%)', v_employees, v_row.target_member_count;
      END IF;

      v_omni_json := v_row.target_addon_selections -> 'omnichannel_roster';
      IF v_omni_json IS NOT NULL AND jsonb_typeof(v_omni_json) = 'object' THEN
        IF COALESCE((v_omni_json ->> 'included')::boolean, false) THEN
          v_omni_target := GREATEST(0, COALESCE((v_omni_json ->> 'quantity')::integer, 0));
        ELSE
          v_omni_target := 0;
        END IF;
      ELSE
        SELECT COALESCE(os.omnichannel_paid_seat_count, 0)
        INTO v_omni_target
        FROM public.organization_subscriptions os
        WHERE os.organization_id = v_row.organization_id;
      END IF;

      SELECT COUNT(*)::integer
      INTO v_roster
      FROM public.organization_omnichannel_staff oos
      WHERE oos.organization_id = v_row.organization_id;

      IF v_roster > v_omni_target THEN
        RAISE EXCEPTION 'omnichannel roster (%) exceeds target paid seats (%)', v_roster, v_omni_target;
      END IF;

      v_lm_json := v_row.target_addon_selections -> 'lead_magnet';
      IF v_lm_json IS NOT NULL AND jsonb_typeof(v_lm_json) = 'object' THEN
        v_lm_target := COALESCE((v_lm_json ->> 'included')::boolean, false);
      ELSE
        SELECT COALESCE(os.lead_magnet_active, false)
        INTO v_lm_target
        FROM public.organization_subscriptions os
        WHERE os.organization_id = v_row.organization_id;
      END IF;

      v_pos_json := v_row.target_addon_selections -> 'pos_outlets';
      IF v_pos_json IS NOT NULL AND jsonb_typeof(v_pos_json) = 'object' THEN
        v_pos_addon_target := COALESCE((v_pos_json ->> 'included')::boolean, false);
        IF v_pos_addon_target THEN
          v_pos_target := GREATEST(0, LEAST(20, COALESCE((v_pos_json ->> 'quantity')::integer, 0)));
        ELSE
          v_pos_target := 0;
        END IF;
      ELSE
        SELECT COALESCE(os.pos_paid_outlet_count, 0), COALESCE(os.pos_addon_active, false)
        INTO v_pos_target, v_pos_addon_target
        FROM public.organization_subscriptions os
        WHERE os.organization_id = v_row.organization_id;
      END IF;

      SELECT COUNT(*)::integer
      INTO v_outlet_count
      FROM public.pos_outlets po
      WHERE po.organization_id = v_row.organization_id
        AND COALESCE(po.is_deleted, false) = false;

      IF v_outlet_count > (1 + v_pos_target) THEN
        RAISE EXCEPTION 'active outlets (%) exceed POS quota (%)', v_outlet_count, (1 + v_pos_target);
      END IF;

      UPDATE public.organization_subscriptions os
      SET
        subscription_plan_id = COALESCE(v_row.target_plan_id, os.subscription_plan_id),
        member_count = v_row.target_member_count,
        billing_cycle = COALESCE(v_row.target_billing_cycle, os.billing_cycle),
        omnichannel_paid_seat_count = v_omni_target,
        lead_magnet_active = v_lm_target,
        pos_paid_outlet_count = v_pos_target,
        pos_addon_active = v_pos_addon_target,
        updated_at = now()
      WHERE os.organization_id = v_row.organization_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'organization subscription not found';
      END IF;

      UPDATE public.subscription_change_requests
      SET status = 'applied', applied_at = now(), apply_error = NULL
      WHERE id = v_row.id;

      v_applied := v_applied + 1;
    EXCEPTION
      WHEN OTHERS THEN
        UPDATE public.subscription_change_requests
        SET status = 'failed', apply_error = SQLERRM, applied_at = now()
        WHERE id = v_row.id;
    END;
  END LOOP;

  RETURN v_applied;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_due_subscription_change_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_due_subscription_change_requests() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Hitung ulang pinjaman online: hanya anggota organisasi utang itu
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.recalculate_pinjaman_online_debt_amount(p_debt_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_debt public.debts%ROWTYPE;
  v_total_expense numeric(15, 2);
  v_remaining numeric(15, 2);
  v_paid numeric(15, 2);
BEGIN
  SELECT * INTO v_debt FROM public.debts WHERE id = p_debt_id;
  IF NOT FOUND OR v_debt.debt_type IS DISTINCT FROM 'Pinjaman Online' THEN
    RETURN;
  END IF;

  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.user_organizations uo
    WHERE uo.user_id = auth.uid()
      AND uo.organization_id = v_debt.organization_id
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(sum(amount), 0) INTO v_total_expense
  FROM public.expenses
  WHERE withdrawal_from_balance = p_debt_id
    AND status IS DISTINCT FROM 'deleted';

  v_paid := coalesce(v_debt.paid_amount, 0);
  v_remaining := greatest(0, v_total_expense - v_paid);

  UPDATE public.debts
  SET
    debt_amount = v_total_expense,
    remaining_debt = v_remaining,
    available_limit = greatest(0, coalesce(limit_amount, 0) - v_remaining),
    updated_at = now()
  WHERE id = p_debt_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recalculate_pinjaman_online_debt_amount(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalculate_pinjaman_online_debt_amount(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Mutasi bank: hanya service_role. Trigger SECURITY DEFINER tetap bisa memanggilnya.
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.upsert_bank_statement_from_erp_expense(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_bank_statement_from_erp_expense(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.upsert_bank_statement_from_gateway_withdrawal(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_bank_statement_from_gateway_withdrawal(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.upsert_bank_statement_from_brick_callback(uuid, uuid, text, timestamptz, numeric, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_bank_statement_from_brick_callback(uuid, uuid, text, timestamptz, numeric, text, text, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.upsert_bank_statement_from_brick_disbursement_callback(uuid, uuid, text, timestamptz, numeric, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_bank_statement_from_brick_disbursement_callback(uuid, uuid, text, timestamptz, numeric, text, text, jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- Pemanggilan edge yang membaca vault. Hanya cron superuser.
-- ---------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.invoke_social_media_scheduler_edge() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.invoke_tiktok_content_scheduler_edge() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.invoke_tiktok_shop_token_refresh_edge() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.invoke_google_ads_pending_conversions_edge() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.invoke_google_contacts_sync_edge() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.invoke_operational_daily_sales_edge() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.invoke_operational_inventory_alerts_edge() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.invoke_dispatch_operational_inventory_alert(uuid) FROM PUBLIC, anon, authenticated;

-- Fungsi baru yang dibuat role sesi ini tidak lagi otomatis bisa dipanggil anon.
-- supabase_admin tidak diubah: sesi SQL editor tidak berhak mengubah default privilege role itu.
DO $$
BEGIN
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'default privileges tidak diubah: %', SQLERRM;
END $$;
