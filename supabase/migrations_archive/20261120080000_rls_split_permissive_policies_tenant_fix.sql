-- Performance Advisor lint 0006 (multiple_permissive_policies) + cross-tenant RLS fix.
--
-- Pattern being fixed: a FOR ALL "write" policy also applies to SELECT, so every read
-- evaluates two (sometimes three) permissive policies. We split each FOR ALL policy into
-- FOR INSERT / UPDATE / DELETE with the exact same expressions, so SELECT only evaluates
-- one policy.
--
-- Access is preserved exactly:
--   mode 'keep'  : the write predicate already implies the select predicate
--                  (identical, or "select AND owner/admin"), so the SELECT policy is unchanged.
--   mode 'union' : the write predicate is not provably narrower (e.g. admin of an org that
--                  is not the active org), so the SELECT policy becomes (select) OR (write).
--
-- SECURITY FIX (behaviour change, intended): organization_whatsapp_templates,
-- organization_whatsapp_web_id_accounts and organization_omnichannel_api_settings had a
-- write policy that only checked get_user_role_in_active_org() IN ('owner','admin') and
-- never compared the row's organization_id. Any owner/admin of any org could read, edit
-- and delete other organizations' rows. The new write policies also require the row to
-- belong to the caller's active organization.
--
-- A snapshot of every affected policy is stored in ops_backup.rls_policies_20261120 so the
-- rollback script can restore the exact originals.

SET LOCAL search_path = public, extensions, pg_temp;

-- 0) Snapshot the current policies of all affected tables.
CREATE SCHEMA IF NOT EXISTS ops_backup;
REVOKE ALL ON SCHEMA ops_backup FROM PUBLIC, anon, authenticated;

CREATE TABLE ops_backup.rls_policies_20261120 AS
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'ai_employee_permissions','ai_employee_profiles','ai_employee_schedules','ai_employee_sop_steps',
    'ai_employee_sops','lead_google_contact_links','lead_magnet_campaign_accounts','lead_magnet_campaign_posts',
    'meta_ads_interest_list_items','meta_ads_interest_lists','omnichannel_conversation_labels','omnichannel_labels',
    'organization_brick_import_settings','organization_google_contacts_connections',
    'organization_linkedin_content_accounts','organization_linkedin_content_connections',
    'organization_meta_ads_display_settings','organization_meta_ads_name_templates',
    'organization_omnichannel_api_settings','organization_omnichannel_api_tokens',
    'organization_social_media_scheduling_settings','organization_tiktok_ads_accounts',
    'organization_tiktok_ads_campaign_services','organization_tiktok_ads_column_sets',
    'organization_tiktok_ads_connections','organization_tiktok_ads_metrics_preferences',
    'organization_tiktok_content_accounts','organization_tiktok_content_connections',
    'organization_tiktok_shop_accounts','organization_tiktok_shop_connections',
    'organization_whatsapp_templates','organization_whatsapp_web_id_accounts',
    'organization_youtube_content_accounts','organization_youtube_content_connections',
    'task_step_comment_read_cursors');
REVOKE ALL ON ops_backup.rls_policies_20261120 FROM PUBLIC, anon, authenticated;

-- 1) Helper: split one FOR ALL policy into INSERT/UPDATE/DELETE.
--    p_override replaces both USING and WITH CHECK (used only for the security fix).
CREATE FUNCTION pg_temp.split_all_policy(
  p_table text, p_all text, p_select text, p_mode text, p_override text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql AS $f$
DECLARE
  v_q text; v_c text; v_cmd text; v_roles text; v_sel text;
BEGIN
  SELECT qual, with_check, cmd, array_to_string(roles, ', ')
    INTO v_q, v_c, v_cmd, v_roles
  FROM pg_policies WHERE schemaname = 'public' AND tablename = p_table AND policyname = p_all;
  IF NOT FOUND OR v_cmd <> 'ALL' OR v_roles <> 'authenticated' THEN
    RAISE EXCEPTION 'unexpected policy %.% (cmd=%, roles=%)', p_table, p_all, v_cmd, v_roles;
  END IF;
  IF p_override IS NOT NULL THEN v_q := p_override; v_c := p_override; END IF;
  v_c := coalesce(v_c, v_q);

  IF p_mode = 'union' THEN
    SELECT qual INTO v_sel FROM pg_policies
    WHERE schemaname = 'public' AND tablename = p_table AND policyname = p_select AND cmd = 'SELECT';
    IF v_sel IS NULL THEN RAISE EXCEPTION 'select policy %.% not found', p_table, p_select; END IF;
    EXECUTE format('ALTER POLICY %I ON public.%I USING ((%s) OR (%s))', p_select, p_table, v_sel, v_q);
  ELSIF p_mode <> 'keep' THEN
    RAISE EXCEPTION 'bad mode %', p_mode;
  END IF;

  EXECUTE format('DROP POLICY %I ON public.%I', p_all, p_table);
  EXECUTE format('CREATE POLICY %I ON public.%I AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (%s)', p_all || '_ins', p_table, v_c);
  EXECUTE format('CREATE POLICY %I ON public.%I AS PERMISSIVE FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)', p_all || '_upd', p_table, v_q, v_c);
  EXECUTE format('CREATE POLICY %I ON public.%I AS PERMISSIVE FOR DELETE TO authenticated USING (%s)', p_all || '_del', p_table, v_q);
END $f$;

-- 2) Write predicate is "select AND owner/admin" or identical to select: keep SELECT as is.
SELECT pg_temp.split_all_policy('ai_employee_permissions', 'ai_employee_permissions_write', 'ai_employee_permissions_select', 'keep');
SELECT pg_temp.split_all_policy('ai_employee_profiles', 'ai_employee_profiles_write', 'ai_employee_profiles_select', 'keep');
SELECT pg_temp.split_all_policy('ai_employee_schedules', 'ai_employee_schedules_write', 'ai_employee_schedules_select', 'keep');
SELECT pg_temp.split_all_policy('ai_employee_sops', 'ai_employee_sops_write', 'ai_employee_sops_select', 'keep');
SELECT pg_temp.split_all_policy('lead_magnet_campaign_accounts', 'lead_magnet_campaign_accounts_mutate_org', 'lead_magnet_campaign_accounts_select_org', 'keep');
SELECT pg_temp.split_all_policy('lead_magnet_campaign_posts', 'lead_magnet_campaign_posts_mutate_org', 'lead_magnet_campaign_posts_select_org', 'keep');
SELECT pg_temp.split_all_policy('omnichannel_conversation_labels', 'omnichannel_conversation_labels_mutate_org', 'omnichannel_conversation_labels_select_org', 'keep');
SELECT pg_temp.split_all_policy('omnichannel_labels', 'omnichannel_labels_mutate_org', 'omnichannel_labels_select_org', 'keep');
SELECT pg_temp.split_all_policy('organization_omnichannel_api_tokens', 'organization_omnichannel_api_tokens_mutate_admin', 'organization_omnichannel_api_tokens_select_admin', 'keep');
SELECT pg_temp.split_all_policy('organization_tiktok_ads_campaign_services', 'organization_tiktok_ads_campaign_services_write', 'organization_tiktok_ads_campaign_services_select', 'keep');
SELECT pg_temp.split_all_policy('organization_tiktok_ads_column_sets', 'organization_tiktok_ads_column_sets_write', 'organization_tiktok_ads_column_sets_select', 'keep');
SELECT pg_temp.split_all_policy('task_step_comment_read_cursors', 'task_step_comment_read_cursors_upsert_own', 'task_step_comment_read_cursors_select_own', 'keep');

-- 3) Write predicate is not provably narrower: SELECT becomes (select) OR (write), access unchanged.
SELECT pg_temp.split_all_policy('ai_employee_sop_steps', 'ai_employee_sop_steps_write', 'ai_employee_sop_steps_select', 'union');
SELECT pg_temp.split_all_policy('lead_google_contact_links', 'lead_google_contact_links_admin_write', 'lead_google_contact_links_select_org', 'union');
SELECT pg_temp.split_all_policy('organization_brick_import_settings', 'organization_brick_import_settings_org_write', 'organization_brick_import_settings_org_select', 'union');
SELECT pg_temp.split_all_policy('organization_google_contacts_connections', 'organization_google_contacts_connections_admin_write', 'organization_google_contacts_connections_select_org', 'union');
SELECT pg_temp.split_all_policy('organization_linkedin_content_accounts', 'organization_linkedin_content_accounts_admin_write', 'organization_linkedin_content_accounts_select_org', 'union');
SELECT pg_temp.split_all_policy('organization_linkedin_content_connections', 'organization_linkedin_content_connections_admin_write', 'organization_linkedin_content_connections_select_org', 'union');
SELECT pg_temp.split_all_policy('organization_meta_ads_display_settings', 'organization_meta_ads_display_settings_admin_write', 'organization_meta_ads_display_settings_select_org', 'union');
SELECT pg_temp.split_all_policy('organization_meta_ads_name_templates', 'organization_meta_ads_name_templates_admin_write', 'organization_meta_ads_name_templates_select_org', 'union');
SELECT pg_temp.split_all_policy('organization_social_media_scheduling_settings', 'organization_social_media_scheduling_settings_admin_write', 'organization_social_media_scheduling_settings_select_org', 'union');
SELECT pg_temp.split_all_policy('organization_tiktok_ads_accounts', 'organization_tiktok_ads_accounts_admin_write', 'organization_tiktok_ads_accounts_select_org', 'union');
SELECT pg_temp.split_all_policy('organization_tiktok_ads_connections', 'organization_tiktok_ads_connections_admin_write', 'organization_tiktok_ads_connections_select_org', 'union');
SELECT pg_temp.split_all_policy('organization_tiktok_ads_metrics_preferences', 'organization_tiktok_ads_metrics_preferences_write', 'organization_tiktok_ads_metrics_preferences_select', 'union');
SELECT pg_temp.split_all_policy('organization_tiktok_content_accounts', 'organization_tiktok_content_accounts_admin_write', 'organization_tiktok_content_accounts_select_org', 'union');
SELECT pg_temp.split_all_policy('organization_tiktok_content_connections', 'organization_tiktok_content_connections_admin_write', 'organization_tiktok_content_connections_select_org', 'union');
SELECT pg_temp.split_all_policy('organization_tiktok_shop_accounts', 'organization_tiktok_shop_accounts_admin_write', 'organization_tiktok_shop_accounts_select_org', 'union');
SELECT pg_temp.split_all_policy('organization_tiktok_shop_connections', 'organization_tiktok_shop_connections_admin_write', 'organization_tiktok_shop_connections_select_org', 'union');
SELECT pg_temp.split_all_policy('organization_youtube_content_accounts', 'organization_youtube_content_accounts_admin_write', 'organization_youtube_content_accounts_select_org', 'union');
SELECT pg_temp.split_all_policy('organization_youtube_content_connections', 'organization_youtube_content_connections_admin_write', 'organization_youtube_content_connections_select_org', 'union');

-- 4) meta_ads_interest_lists / _list_items: the per-command policies (_select/_insert/_update/
--    _delete = active org AND admin) are strict subsets of admin_write (admin of the row's org)
--    and select_org, so they add nothing. Drop them, then split admin_write in union mode.
DROP POLICY meta_ads_interest_lists_select ON public.meta_ads_interest_lists;
DROP POLICY meta_ads_interest_lists_insert ON public.meta_ads_interest_lists;
DROP POLICY meta_ads_interest_lists_update ON public.meta_ads_interest_lists;
DROP POLICY meta_ads_interest_lists_delete ON public.meta_ads_interest_lists;
SELECT pg_temp.split_all_policy('meta_ads_interest_lists', 'meta_ads_interest_lists_admin_write', 'meta_ads_interest_lists_select_org', 'union');

DROP POLICY meta_ads_interest_list_items_select ON public.meta_ads_interest_list_items;
DROP POLICY meta_ads_interest_list_items_insert ON public.meta_ads_interest_list_items;
DROP POLICY meta_ads_interest_list_items_update ON public.meta_ads_interest_list_items;
DROP POLICY meta_ads_interest_list_items_delete ON public.meta_ads_interest_list_items;
SELECT pg_temp.split_all_policy('meta_ads_interest_list_items', 'meta_ads_interest_list_items_admin_write', 'meta_ads_interest_list_items_select_org', 'union');

-- 5) SECURITY FIX: scope owner/admin writes to the caller's active organization.
--    The new write predicate implies the existing select_org predicate, so SELECT is unchanged
--    (members of the active org can still read; other orgs can no longer read or write).
SELECT pg_temp.split_all_policy('organization_whatsapp_templates', 'organization_whatsapp_templates_mutate_admin', 'organization_whatsapp_templates_select_org', 'keep',
  '(organization_id IN (SELECT p.active_organization_id FROM profiles p WHERE p.user_id = (SELECT auth.uid()))) AND (get_user_role_in_active_org() = ANY (ARRAY[''owner''::text, ''admin''::text]))');
SELECT pg_temp.split_all_policy('organization_whatsapp_web_id_accounts', 'organization_whatsapp_web_id_accounts_mutate_admin', 'organization_whatsapp_web_id_accounts_select_org', 'keep',
  '(organization_id IN (SELECT p.active_organization_id FROM profiles p WHERE p.user_id = (SELECT auth.uid()))) AND (get_user_role_in_active_org() = ANY (ARRAY[''owner''::text, ''admin''::text]))');
SELECT pg_temp.split_all_policy('organization_omnichannel_api_settings', 'organization_omnichannel_api_settings_mutate_admin', 'organization_omnichannel_api_settings_select_org', 'keep',
  '(organization_id IN (SELECT p.active_organization_id FROM profiles p WHERE p.user_id = (SELECT auth.uid()))) AND (get_user_role_in_active_org() = ANY (ARRAY[''owner''::text, ''admin''::text]))');

-- 6) Guard: no FOR ALL policy may remain on these tables, and every table still has a SELECT policy.
DO $$
DECLARE v_all int; v_nosel int;
BEGIN
  SELECT count(*) INTO v_all FROM pg_policies
  WHERE schemaname = 'public' AND cmd = 'ALL'
    AND tablename IN (SELECT DISTINCT tablename FROM ops_backup.rls_policies_20261120);
  SELECT count(*) INTO v_nosel FROM (SELECT DISTINCT tablename FROM ops_backup.rls_policies_20261120) t
  WHERE NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = t.tablename AND p.cmd = 'SELECT');
  IF v_all <> 0 OR v_nosel <> 0 THEN
    RAISE EXCEPTION 'guard failed: remaining ALL policies=%, tables without SELECT=%', v_all, v_nosel;
  END IF;
END $$;
