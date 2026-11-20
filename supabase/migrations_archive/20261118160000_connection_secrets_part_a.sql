-- Connection secrets, part A of 2 (additive only; safe with the current app).
-- Adds has_* flags, the restrict_secret_columns() helper and the owner/admin RPCs used by the new app code.
-- Part B (20261118160100_lock_connection_secrets.sql) applies the column privileges and delete policies;
-- run it only after the new frontend and edge functions are live.

-- 1) "Is a token stored?" flags for the UI.
alter table public.organization_facebook_pages
  add column if not exists has_page_access_token boolean
  generated always as (coalesce(btrim(page_access_token), '') <> '') stored;
alter table public.organization_instagram_accounts
  add column if not exists has_page_access_token boolean
  generated always as (coalesce(btrim(page_access_token), '') <> '') stored;
alter table public.organization_meta_config
  add column if not exists has_meta_access_token boolean
  generated always as (coalesce(btrim(meta_access_token), '') <> '') stored;
alter table public.organization_whatsapp_accounts
  add column if not exists has_meta_access_token boolean
  generated always as (coalesce(btrim(meta_access_token), '') <> '') stored;
alter table public.organization_whatsapp_config
  add column if not exists has_whatsapp_access_token boolean
  generated always as (coalesce(btrim(whatsapp_access_token), '') <> '') stored;

-- 2) Helper: grant authenticated every column except the secrets; anon gets nothing.
create or replace function public.restrict_secret_columns(p_table regclass, p_secret text[])
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_readable text;
  v_writable text;
begin
  select string_agg(quote_ident(a.attname), ', ' order by a.attnum)
    into v_readable
    from pg_attribute a
   where a.attrelid = p_table and a.attnum > 0 and not a.attisdropped
     and a.attname <> all (p_secret);

  select string_agg(quote_ident(a.attname), ', ' order by a.attnum)
    into v_writable
    from pg_attribute a
   where a.attrelid = p_table and a.attnum > 0 and not a.attisdropped
     and a.attgenerated = ''
     and a.attname <> all (p_secret);

  execute format('revoke all on table %s from anon, authenticated', p_table);
  execute format('grant select (%s) on table %s to authenticated', v_readable, p_table);
  execute format('grant insert (%s) on table %s to authenticated', v_writable, p_table);
  execute format('grant update (%s) on table %s to authenticated', v_writable, p_table);
  execute format('grant delete on table %s to authenticated', p_table);
end;
$$;

revoke all on function public.restrict_secret_columns(regclass, text[]) from public, anon, authenticated;

-- 3) The only browser path to write a secret. Owner/admin of the row's organization only.
--    p_value null or blank clears it. Returns nothing about the stored value.
create or replace function public.set_org_connection_secret(p_kind text, p_row_id uuid, p_value text)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_table text;
  v_column text;
  v_flag text;
  v_org uuid;
  v_value text := nullif(btrim(coalesce(p_value, '')), '');
begin
  case p_kind
    when 'facebook_page_token'    then v_table := 'organization_facebook_pages';     v_column := 'page_access_token';
    when 'instagram_page_token'   then v_table := 'organization_instagram_accounts'; v_column := 'page_access_token';
    when 'meta_config_token'      then v_table := 'organization_meta_config';        v_column := 'meta_access_token';
    when 'whatsapp_account_token' then v_table := 'organization_whatsapp_accounts';  v_column := 'meta_access_token';
    when 'whatsapp_config_token'  then v_table := 'organization_whatsapp_config';    v_column := 'whatsapp_access_token';
    when 'script_ai_google'       then v_table := 'organization_script_ai_config';   v_column := 'google_ai_api_key'; v_flag := 'api_key_configured';
    when 'script_ai_openai'       then v_table := 'organization_script_ai_config';   v_column := 'openai_api_key';    v_flag := 'openai_api_key_configured';
    when 'script_ai_claude'       then v_table := 'organization_script_ai_config';   v_column := 'claude_api_key';    v_flag := 'claude_api_key_configured';
    when 'video_ai_byteplus'      then v_table := 'organization_video_ai_config';    v_column := 'byteplus_api_key';  v_flag := 'api_key_configured';
    when 'voice_ai_elevenlabs'    then v_table := 'organization_voice_ai_config';    v_column := 'elevenlabs_api_key'; v_flag := 'api_key_configured';
    else raise exception 'unknown_secret_kind' using errcode = '22023';
  end case;

  execute format('select organization_id from public.%I where id = $1', v_table) into v_org using p_row_id;
  if v_org is null then
    raise exception 'connection_not_found' using errcode = 'P0002';
  end if;
  if not public.user_is_org_owner_or_admin(v_org) then
    raise exception 'Hanya owner atau admin yang bisa mengubah kunci koneksi.' using errcode = '42501';
  end if;

  if v_flag is null then
    execute format('update public.%I set %I = $1, updated_at = now() where id = $2', v_table, v_column)
      using v_value, p_row_id;
  else
    execute format('update public.%I set %I = $1, %I = ($1 is not null), updated_at = now() where id = $2',
                   v_table, v_column, v_flag)
      using v_value, p_row_id;
  end if;
end;
$$;

revoke all on function public.set_org_connection_secret(text, uuid, text) from public, anon;
grant execute on function public.set_org_connection_secret(text, uuid, text) to authenticated;

-- 4) A new WhatsApp number can reuse the org's shared Meta token without the browser seeing it.
create or replace function public.use_shared_whatsapp_token(p_account_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_org uuid;
  v_token text;
begin
  select organization_id into v_org from public.organization_whatsapp_accounts where id = p_account_id;
  if v_org is null then
    raise exception 'connection_not_found' using errcode = 'P0002';
  end if;
  if not public.user_is_org_owner_or_admin(v_org) then
    raise exception 'Hanya owner atau admin yang bisa mengubah kunci koneksi.' using errcode = '42501';
  end if;
  select nullif(btrim(meta_access_token), '') into v_token
    from public.organization_meta_config where organization_id = v_org;
  if v_token is null then
    return false;
  end if;
  update public.organization_whatsapp_accounts
     set meta_access_token = v_token, updated_at = now()
   where id = p_account_id;
  return true;
end;
$$;

revoke all on function public.use_shared_whatsapp_token(uuid) from public, anon;
grant execute on function public.use_shared_whatsapp_token(uuid) to authenticated;

