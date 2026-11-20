-- Pin search_path on 42 public functions flagged by the Supabase security advisor
-- (lint 0011 function_search_path_mutable). Behaviour is unchanged: the pinned value
-- equals the role default these functions already resolved against (public, extensions),
-- but a caller can no longer change which objects they resolve to.
--
-- Scope: every flagged plpgsql function, plus SQL functions marked STABLE.
-- Not included on purpose: 45 IMMUTABLE pure SQL helpers (traffic_*, billing term,
-- permission-key lists, ...). Adding a SET clause stops Postgres from inlining them,
-- which would slow the analytics/POS queries that call them per row, and they do not
-- reference tables, so a search_path change cannot redirect them to other objects.
--
-- Rollback: supabase/rollback/20261120_function_search_path_rollback.sql

BEGIN;

ALTER FUNCTION public._build_plan_features_from_modules(p_base_price_per_member numeric, p_modules jsonb, p_max_members integer) SET search_path = public, extensions;
ALTER FUNCTION public._parse_member_limit_from_features(p_features jsonb) SET search_path = public, extensions;
ALTER FUNCTION public._resolve_plan_max_members(p_max_members integer, p_jumlah_hari_trial integer, p_base_price_per_member numeric) SET search_path = public, extensions;
ALTER FUNCTION public._synckerja_order_hhmm_minutes(p_value text) SET search_path = public, extensions;
ALTER FUNCTION public._synckerja_order_hour_rule(p_hours jsonb, p_dow integer) SET search_path = public, extensions;
ALTER FUNCTION public._synckerja_order_line_modifiers_text(p_line jsonb) SET search_path = public, extensions;
ALTER FUNCTION public._validate_billing_term_discounts(p_discounts jsonb) SET search_path = public, extensions;
ALTER FUNCTION public._validate_plan_max_members(p_max_members integer) SET search_path = public, extensions;
ALTER FUNCTION public.admin_validate_price_amount(p_amount numeric) SET search_path = public, extensions;
ALTER FUNCTION public.catalog_ingredient_recipe_validate_line() SET search_path = public, extensions;
ALTER FUNCTION public.catalog_ingredient_recipe_validate_output() SET search_path = public, extensions;
ALTER FUNCTION public.catalog_product_recipe_validate_header() SET search_path = public, extensions;
ALTER FUNCTION public.catalog_product_recipe_validate_line() SET search_path = public, extensions;
ALTER FUNCTION public.did_cross_inventory_alert_threshold(p_prev numeric, p_next numeric, p_alert_enabled boolean, p_alert_at numeric) SET search_path = public, extensions;
ALTER FUNCTION public.enforce_employee_shift_no_overlap() SET search_path = public, extensions;
ALTER FUNCTION public.enforce_gateway_payout_validation() SET search_path = public, extensions;
ALTER FUNCTION public.generate_pos_outlet_public_code() SET search_path = public, extensions;
ALTER FUNCTION public.income_allocation_is_complete(p_income_type_id uuid, p_category_id uuid, p_bank_account_id uuid) SET search_path = public, extensions;
ALTER FUNCTION public.income_status_after_deposit(p_income_type_id uuid, p_category_id uuid, p_bank_account_id uuid) SET search_path = public, extensions;
ALTER FUNCTION public.inventory_alert_wib_today() SET search_path = public, extensions;
ALTER FUNCTION public.is_app_working_day(p_working_days integer[], p_date date) SET search_path = public, extensions;
ALTER FUNCTION public.lead_magnet_campaigns_set_updated_at() SET search_path = public, extensions;
ALTER FUNCTION public.lead_magnet_enrollments_set_updated_at() SET search_path = public, extensions;
ALTER FUNCTION public.mcp_inbox_bounds(p_start date, p_end date) SET search_path = public, extensions;
ALTER FUNCTION public.mcp_inbox_check_channel(p_channel text) SET search_path = public, extensions;
ALTER FUNCTION public.omnichannel_automation_flows_set_updated_at() SET search_path = public, extensions;
ALTER FUNCTION public.omnichannel_flow_enrollments_set_updated_at() SET search_path = public, extensions;
ALTER FUNCTION public.payroll_calculate_overtime_pay(p_org_id uuid, p_employee_id uuid, p_period_start date, p_period_end date, p_basic_salary numeric) SET search_path = public, extensions;
ALTER FUNCTION public.payroll_calculate_pph21_annualized(p_monthly_gross numeric, p_ptkp_status text, p_custom_ptkp numeric, p_non_taxable_annual numeric) SET search_path = public, extensions;
ALTER FUNCTION public.payroll_calculate_pph21_ter(p_monthly_gross numeric, p_ptkp_status text, p_effective_year integer) SET search_path = public, extensions;
ALTER FUNCTION public.payroll_calculate_pph21_ter_v2(p_monthly_gross numeric, p_employee_tax_status text, p_ptkp_status text, p_effective_year integer) SET search_path = public, extensions;
ALTER FUNCTION public.payroll_calculate_tax_by_method(p_gross numeric, p_ptkp_status text, p_tax_method text, p_custom_ptkp numeric, p_non_taxable_annual numeric, p_target_take_home numeric) SET search_path = public, extensions;
ALTER FUNCTION public.payroll_calculate_thr_amount(p_org_id uuid, p_employee_id uuid, p_basic_salary numeric, p_period_end date) SET search_path = public, extensions;
ALTER FUNCTION public.payroll_count_shift_assigned_working_days(p_org_id uuid, p_employee_id uuid, p_start date, p_end date, p_count_holiday_as_working boolean) SET search_path = public, extensions;
ALTER FUNCTION public.payroll_count_working_days(p_org_id uuid, p_start date, p_end date, p_working_days integer[], p_count_holiday_as_working boolean) SET search_path = public, extensions;
ALTER FUNCTION public.payroll_employee_prorate_ratio(p_org_id uuid, p_period_start date, p_period_end date, p_employee_id uuid, p_count_holiday_as_working boolean) SET search_path = public, extensions;
ALTER FUNCTION public.pos_invoice_display_status(p_invoice_cancelled_at timestamp with time zone, p_invoice_due_date date, p_payment_status text, p_total_amount numeric, p_total_paid_amount numeric) SET search_path = public, extensions;
ALTER FUNCTION public.pos_outlets_assign_public_code() SET search_path = public, extensions;
ALTER FUNCTION public.trg_task_step_comments_updated_at() SET search_path = public, extensions;
ALTER FUNCTION public.update_organization_caption_hashtags_updated_at() SET search_path = public, extensions;
ALTER FUNCTION public.update_organization_caption_mention_handles_updated_at() SET search_path = public, extensions;
ALTER FUNCTION public.update_organization_facebook_pages_updated_at() SET search_path = public, extensions;

COMMIT;
