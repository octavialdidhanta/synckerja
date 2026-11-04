-- Rollback 20261104130000_kuning_critical_fixes.sql. Bukan migration; jalankan di SQL Editor.
-- Mengembalikan definisi dan izin persis seperti sebelum 4 November 2026.

BEGIN;

-- 1) _lead_merge_assert_org_access (definisi lama, termasuk celah current_user)
CREATE OR REPLACE FUNCTION public._lead_merge_assert_org_access(p_organization_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
  v_session text;
  v_current text;
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id_required' USING ERRCODE = 'P0001';
  END IF;

  -- Dashboard SQL Editor / migrations run as DB owner, not JWT service_role.
  v_session := session_user;
  v_current := current_user;
  IF v_session IN ('postgres', 'supabase_admin')
     OR v_current IN ('postgres', 'supabase_admin') THEN
    RETURN;
  END IF;

  v_role := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
  IF v_role = 'service_role' THEN
    RETURN;
  END IF;
  IF p_organization_id IN (SELECT public.user_organization_ids()) THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'P0001';
END;
$function$;
GRANT EXECUTE ON FUNCTION public.merge_checkout_identity_bridge_execute(uuid, uuid, uuid, boolean) TO anon;

-- 2) pos_shift_detail: kembalikan guard lama
DO $rb$
DECLARE v_def text; v_new text;
BEGIN
  v_def := pg_get_functiondef('public.pos_shift_detail(uuid)'::regprocedure);
  v_new := regexp_replace(
    v_def,
    'IF auth\.uid\(\) IS NULL THEN\s+IF coalesce\(auth\.role\(\), current_setting\(''request\.jwt\.claim\.role'', true\), ''''\) <> ''service_role'' THEN\s+RAISE EXCEPTION ''not_authenticated'';\s+END IF;\s+ELSIF v_shift\.organization_id NOT IN \(SELECT public\.user_organization_ids\(\)\)\s+OR NOT public\.user_is_org_owner_or_admin\(v_shift\.organization_id\) THEN\s+RAISE EXCEPTION ''forbidden_org'';\s+END IF;',
    E'IF auth.uid() IS NOT NULL\n     AND v_shift.organization_id NOT IN (SELECT public.user_organization_ids()) THEN\n    RAISE EXCEPTION ''forbidden_org'';\n  END IF;'
  );
  IF v_new = v_def THEN RAISE EXCEPTION 'pos_shift_detail: pola tidak ditemukan'; END IF;
  EXECUTE v_new;
END
$rb$;
GRANT EXECUTE ON FUNCTION public.pos_shift_detail(uuid) TO anon;

-- 3) pos_ensure_open_shift (definisi lama; isi sama, hanya beda akhir baris CRLF dari aslinya)
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
  IF p_organization_id NOT IN (SELECT public.user_organization_ids()) THEN
    RAISE EXCEPTION 'forbidden_org';
  END IF;

  SELECT * INTO v_row
  FROM public.pos_cashier_shifts
  WHERE outlet_id = p_outlet_id AND status = 'open'
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
GRANT EXECUTE ON FUNCTION public.pos_ensure_open_shift(uuid, uuid) TO anon;

-- 4) Laporan POS: hapus syarat owner/admin, kembalikan anon
DO $rb$
DECLARE v_fn text; v_oid oid; v_def text; v_new text;
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
BEGIN
  FOREACH v_fn IN ARRAY v_fns LOOP
    SELECT p.oid INTO STRICT v_oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = v_fn;
    v_def := pg_get_functiondef(v_oid);
    v_new := replace(v_def, ' OR NOT public.user_is_org_owner_or_admin(p_organization_id)', '');
    IF v_new <> v_def THEN EXECUTE v_new; END IF;
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', v_oid::regprocedure);
    -- Sebelum 4 Nov, sebagian laporan juga punya EXECUTE untuk PUBLIC.
    IF v_fn = ANY (ARRAY[
      'pos_collected_by_sales_by_payment','pos_collected_by_sales_report','pos_discount_sales_by_value',
      'pos_discount_sales_report','pos_gratuity_sales_by_rate','pos_gratuity_sales_report',
      'pos_invoices_report','pos_modifier_sales_by_option','pos_modifier_sales_report',
      'pos_served_by_sales_by_sales_type','pos_served_by_sales_report','pos_tax_sales_by_rate',
      'pos_tax_sales_report','pos_transactions_cancelled_orders','pos_transactions_success_orders',
      'pos_transactions_void_items'
    ]) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC', v_oid::regprocedure);
    END IF;
  END LOOP;
END
$rb$;

COMMIT;
NOTIFY pgrst, 'reload schema';
