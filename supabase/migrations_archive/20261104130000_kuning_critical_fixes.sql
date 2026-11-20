-- Hardening 4 November 2026: temuan kritis tinjauan fungsi KUNING (langkah 5)
-- + laporan POS hanya owner/admin (keputusan owner 4 Nov).
-- Laporan: docs/security/fungsi-kuning-anon-4-nov-2026.md
-- Rollback: supabase/rollback/20261104_kuning_critical_fixes_rollback.sql

-- ---------------------------------------------------------------------------
-- 1) _lead_merge_assert_org_access
-- Sebelumnya lolos bila current_user = 'postgres'. Fungsi ini SECURITY DEFINER
-- milik postgres, jadi current_user di dalamnya selalu postgres dan cek org
-- tidak pernah berjalan (anon dan org lain bisa memanggil merge lead).
-- Sekarang: pengecualian hanya untuk sesi DB owner TANPA JWT (SQL Editor /
-- migration), service_role, atau anggota org.
-- Dipakai: merge_checkout_identity_bridge_* (checkout POS, kasir),
-- merge_customer_lead_duplicates_*, merge_identity_graph_leads_*,
-- merge_typo_email_leads_*.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._lead_merge_assert_org_access(p_organization_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id_required' USING ERRCODE = 'P0001';
  END IF;

  v_role := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');

  -- SQL Editor / migration: sesi DB owner tanpa JWT. session_user tidak berubah
  -- oleh SECURITY DEFINER (berbeda dengan current_user).
  IF v_role = '' AND session_user IN ('postgres', 'supabase_admin') THEN
    RETURN;
  END IF;

  IF v_role = 'service_role' THEN
    RETURN;
  END IF;

  IF auth.uid() IS NOT NULL
     AND p_organization_id IN (SELECT public.user_organization_ids()) THEN
    RETURN;
  END IF;

  RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'P0001';
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.merge_checkout_identity_bridge_execute(uuid, uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_checkout_identity_bridge_execute(uuid, uuid, uuid, boolean) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2) pos_shift_detail: tolak anon (sebelumnya cek org dilewati bila
--    auth.uid() NULL). Laporan shift → owner/admin. service_role tetap
--    (edge function dispatch-pos-shift-recap).
-- ---------------------------------------------------------------------------
DO $fix$
DECLARE
  v_def text;
  v_new text;
BEGIN
  v_def := pg_get_functiondef('public.pos_shift_detail(uuid)'::regprocedure);
  v_new := regexp_replace(
    v_def,
    'IF\s+auth\.uid\(\)\s+IS\s+NOT\s+NULL\s+AND\s+v_shift\.organization_id\s+NOT\s+IN\s+\(\s*SELECT\s+public\.user_organization_ids\(\)\s*\)\s+THEN\s+RAISE\s+EXCEPTION\s+''forbidden_org'';\s+END\s+IF;',
    E'IF auth.uid() IS NULL THEN\n    IF coalesce(auth.role(), current_setting(''request.jwt.claim.role'', true), '''') <> ''service_role'' THEN\n      RAISE EXCEPTION ''not_authenticated'';\n    END IF;\n  ELSIF v_shift.organization_id NOT IN (SELECT public.user_organization_ids())\n     OR NOT public.user_is_org_owner_or_admin(v_shift.organization_id) THEN\n    RAISE EXCEPTION ''forbidden_org'';\n  END IF;'
  );
  IF v_new = v_def THEN
    RAISE EXCEPTION 'pos_shift_detail: pola guard tidak ditemukan, migration dihentikan';
  END IF;
  EXECUTE v_new;
END
$fix$;

REVOKE EXECUTE ON FUNCTION public.pos_shift_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_shift_detail(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) pos_ensure_open_shift: outlet wajib milik organisasi yang dicek
--    (sebelumnya shift outlet org lain bisa dikembalikan). Dipakai aplikasi
--    kasir, jadi tetap untuk anggota org.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pos_ensure_open_shift(p_organization_id uuid, p_outlet_id uuid)
 RETURNS pos_cashier_shifts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_row public.pos_cashier_shifts;
  v_settings public.pos_outlet_shift_settings;
  v_opening numeric := 100000;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_organization_id IS NULL OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.pos_outlets o
    WHERE o.id = p_outlet_id
      AND o.organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'outlet_not_found';
  END IF;

  SELECT * INTO v_row
  FROM public.pos_cashier_shifts
  WHERE outlet_id = p_outlet_id
    AND organization_id = p_organization_id
    AND status = 'open'
  LIMIT 1;

  IF FOUND THEN
    RETURN v_row;
  END IF;

  SELECT * INTO v_settings
  FROM public.pos_outlet_shift_settings
  WHERE outlet_id = p_outlet_id;

  IF NOT FOUND OR v_settings.auto_start_enabled IS NOT TRUE THEN
    RAISE EXCEPTION 'shift_required';
  END IF;

  v_opening := GREATEST(COALESCE(v_settings.default_opening_cash, 100000), 0);
  RETURN public.pos_start_shift(p_organization_id, p_outlet_id, v_opening);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.pos_ensure_open_shift(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_ensure_open_shift(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4) Laporan dan dashboard POS: hanya owner/admin (user_is_org_owner_or_admin).
-- Semua 33 fungsi memakai guard yang sama:
--   ELSIF p_organization_id IS NULL OR p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
-- Ditambah: OR NOT public.user_is_org_owner_or_admin(p_organization_id)
-- Badan lain tidak diubah. service_role (auth.uid() NULL) tetap lewat cabang pertama.
-- ---------------------------------------------------------------------------
DO $fix$
DECLARE
  v_fn text;
  v_def text;
  v_new text;
  v_fns text[] := ARRAY[
    'pos_brand_sales_by_item','pos_brand_sales_by_outlet','pos_brand_sales_report',
    'pos_category_sales_report','pos_collected_by_sales_by_payment','pos_collected_by_sales_report',
    'pos_dashboard_gross_by_dow','pos_dashboard_gross_by_hour','pos_discount_sales_by_value',
    'pos_discount_sales_report','pos_gratuity_sales_by_rate','pos_gratuity_sales_report',
    'pos_gross_profit_by_item','pos_gross_profit_daily','pos_gross_profit_non_product_breakdown',
    'pos_gross_profit_report','pos_invoices_report','pos_item_sales_hourly','pos_item_sales_report',
    'pos_modifier_sales_by_option','pos_modifier_sales_report','pos_payment_methods_report',
    'pos_sales_summary_daily','pos_sales_summary_report','pos_sales_type_report',
    'pos_served_by_sales_by_sales_type','pos_served_by_sales_report','pos_shift_report',
    'pos_tax_sales_by_rate','pos_tax_sales_report','pos_transactions_cancelled_orders',
    'pos_transactions_success_orders','pos_transactions_void_items'
  ];
  v_oid oid;
BEGIN
  FOREACH v_fn IN ARRAY v_fns LOOP
    SELECT p.oid INTO STRICT v_oid
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = v_fn;

    v_def := pg_get_functiondef(v_oid);
    IF v_def ~ 'user_is_org_owner_or_admin' THEN
      CONTINUE; -- sudah diterapkan
    END IF;
    v_new := regexp_replace(
      v_def,
      '(ELSIF\s+p_organization_id\s+IS\s+NULL\s+OR\s+p_organization_id\s+NOT\s+IN\s+\(\s*SELECT\s+public\.user_organization_ids\(\)\s*\))(\s+THEN)',
      '\1 OR NOT public.user_is_org_owner_or_admin(p_organization_id)\2'
    );
    IF v_new = v_def THEN
      RAISE EXCEPTION '%: pola guard tidak ditemukan, migration dihentikan', v_fn;
    END IF;
    EXECUTE v_new;
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', v_oid::regprocedure);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', v_oid::regprocedure);
  END LOOP;
END
$fix$;

NOTIFY pgrst, 'reload schema';
