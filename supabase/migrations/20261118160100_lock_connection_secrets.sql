-- Connection secrets, part B of 2: lock the token / API key columns away from the browser.
--
-- Before: RLS let every member of an org SELECT/UPDATE/DELETE these rows, so any employee could read
-- page tokens and API keys in plain text with their own session, or overwrite/delete a connection.
-- After:
--   * anon has no access; authenticated can SELECT/INSERT/UPDATE only non-secret columns.
--     Edge functions use service_role and are unaffected.
--   * Secrets are written only through set_org_connection_secret() (owner/admin, part A).
--   * Deleting a connection row is owner/admin only.
--
-- Requires the app version that selects explicit columns (no select('*') on these tables).
-- IMPORTANT for future migrations: column privileges do not cover columns added later. After adding
-- a column to one of these tables, re-run its restrict_secret_columns(...) line below.

select public.restrict_secret_columns('public.organization_facebook_pages'::regclass, array['page_access_token']);
select public.restrict_secret_columns('public.organization_instagram_accounts'::regclass, array['page_access_token']);
select public.restrict_secret_columns('public.organization_meta_config'::regclass, array['meta_access_token']);
select public.restrict_secret_columns('public.organization_whatsapp_accounts'::regclass, array['meta_access_token']);
select public.restrict_secret_columns('public.organization_whatsapp_config'::regclass, array['whatsapp_access_token']);
select public.restrict_secret_columns('public.organization_script_ai_config'::regclass, array['google_ai_api_key', 'openai_api_key', 'claude_api_key']);
select public.restrict_secret_columns('public.organization_video_ai_config'::regclass, array['byteplus_api_key']);
select public.restrict_secret_columns('public.organization_voice_ai_config'::regclass, array['elevenlabs_api_key']);

-- 5) Disconnecting (deleting) a connection is owner/admin only.
drop policy if exists "Users can delete own org facebook pages" on public.organization_facebook_pages;
drop policy if exists "Owner or admin can delete org facebook pages" on public.organization_facebook_pages;
create policy "Owner or admin can delete org facebook pages" on public.organization_facebook_pages
  for delete to authenticated using (public.user_is_org_owner_or_admin(organization_id));

drop policy if exists "Users can delete own org instagram accounts" on public.organization_instagram_accounts;
drop policy if exists "Owner or admin can delete org instagram accounts" on public.organization_instagram_accounts;
create policy "Owner or admin can delete org instagram accounts" on public.organization_instagram_accounts
  for delete to authenticated using (public.user_is_org_owner_or_admin(organization_id));

drop policy if exists "Users can delete own org meta config" on public.organization_meta_config;
drop policy if exists "Owner or admin can delete org meta config" on public.organization_meta_config;
create policy "Owner or admin can delete org meta config" on public.organization_meta_config
  for delete to authenticated using (public.user_is_org_owner_or_admin(organization_id));

drop policy if exists "Users can delete own org whatsapp accounts" on public.organization_whatsapp_accounts;
drop policy if exists "Owner or admin can delete org whatsapp accounts" on public.organization_whatsapp_accounts;
create policy "Owner or admin can delete org whatsapp accounts" on public.organization_whatsapp_accounts
  for delete to authenticated using (public.user_is_org_owner_or_admin(organization_id));

drop policy if exists "Users can delete own org whatsapp config" on public.organization_whatsapp_config;
drop policy if exists "Owner or admin can delete org whatsapp config" on public.organization_whatsapp_config;
create policy "Owner or admin can delete org whatsapp config" on public.organization_whatsapp_config
  for delete to authenticated using (public.user_is_org_owner_or_admin(organization_id));

drop policy if exists "Users can delete own org script ai config" on public.organization_script_ai_config;
drop policy if exists "Owner or admin can delete org script ai config" on public.organization_script_ai_config;
create policy "Owner or admin can delete org script ai config" on public.organization_script_ai_config
  for delete to authenticated using (public.user_is_org_owner_or_admin(organization_id));
