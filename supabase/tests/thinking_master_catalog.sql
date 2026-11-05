-- Katalog parent Master Thought.
-- Jalankan di dalam transaksi, lalu ROLLBACK.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.insert_auth_user(p_id uuid, p_email text)
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_names text[] := ARRAY[
    'instance_id', 'id', 'aud', 'role', 'email', 'encrypted_password',
    'email_confirmed_at', 'raw_app_meta_data', 'raw_user_meta_data',
    'created_at', 'updated_at', 'confirmation_token', 'recovery_token',
    'email_change_token_new', 'email_change', 'is_sso_user', 'is_anonymous'
  ];
  v_name text;
  v_cols text[] := ARRAY[]::text[];
  v_vals text[] := ARRAY[]::text[];
  v_value text;
BEGIN
  FOREACH v_name IN ARRAY v_names LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'auth'
        AND table_name = 'users'
        AND column_name = v_name
        AND COALESCE(is_generated, 'NEVER') = 'NEVER'
    ) THEN
      v_value := CASE v_name
        WHEN 'instance_id' THEN quote_literal('00000000-0000-0000-0000-000000000000')
        WHEN 'id' THEN quote_literal(p_id::text)
        WHEN 'aud' THEN quote_literal('authenticated')
        WHEN 'role' THEN quote_literal('authenticated')
        WHEN 'email' THEN quote_literal(p_email)
        WHEN 'encrypted_password' THEN quote_literal('test-not-a-real-password')
        WHEN 'email_confirmed_at' THEN 'now()'
        WHEN 'raw_app_meta_data' THEN quote_literal('{"provider":"email","providers":["email"]}') || '::jsonb'
        WHEN 'raw_user_meta_data' THEN quote_literal('{}') || '::jsonb'
        WHEN 'created_at' THEN 'now()'
        WHEN 'updated_at' THEN 'now()'
        WHEN 'confirmation_token' THEN quote_literal('')
        WHEN 'recovery_token' THEN quote_literal('')
        WHEN 'email_change_token_new' THEN quote_literal('')
        WHEN 'email_change' THEN quote_literal('')
        WHEN 'is_sso_user' THEN 'false'
        WHEN 'is_anonymous' THEN 'false'
      END;
      v_cols := v_cols || quote_ident(v_name);
      v_vals := v_vals || v_value;
    END IF;
  END LOOP;

  EXECUTE format(
    'INSERT INTO auth.users (%s) VALUES (%s)',
    array_to_string(v_cols, ', '),
    array_to_string(v_vals, ', ')
  );
END;
$fn$;

DO $test$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_org uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_service uuid := gen_random_uuid();
  v_foreign uuid := gen_random_uuid();
  v_master uuid := gen_random_uuid();
  v_thought uuid := gen_random_uuid();
  v_territory uuid := gen_random_uuid();
  v_angle uuid := gen_random_uuid();
  v_statement text;
  v_status text;
  v_service_id uuid;
  v_failed boolean := false;
BEGIN
  PERFORM pg_temp.insert_auth_user(v_owner, 'catalog-parent-owner@example.com');

  INSERT INTO public.organizations (id, company_name, industry, created_by)
  VALUES
    (v_org, 'Catalog Parent Test', 'software', v_owner),
    (v_other, 'Catalog Parent Other', 'software', v_owner);

  INSERT INTO public.services (id, organization_id, name, is_active)
  VALUES
    (v_service, v_org, 'Synckerja Office', true),
    (v_foreign, v_other, 'Etix', true);

  INSERT INTO public.thinking_master_thoughts (
    id, organization_id, statement, original_input, status, mt_status, workspace, canonical_semantic
  ) VALUES (
    v_master, v_org, 'Tetap kalimat', 'Tetap kalimat', 'locked', 'locked', 'thinking_lab', '{}'::jsonb
  );

  UPDATE public.thinking_master_thoughts
  SET service_id = v_service
  WHERE id = v_master;

  SELECT statement, mt_status, service_id
  INTO v_statement, v_status, v_service_id
  FROM public.thinking_master_thoughts
  WHERE id = v_master;

  IF v_statement <> 'Tetap kalimat' OR v_status <> 'locked' OR v_service_id <> v_service THEN
    RAISE EXCEPTION 'katalog mengubah kalimat atau status kunci';
  END IF;

  BEGIN
    UPDATE public.thinking_master_thoughts
    SET service_id = v_foreign
    WHERE id = v_master;
    RAISE EXCEPTION 'katalog organisasi lain lolos';
  EXCEPTION
    WHEN check_violation THEN
      IF SQLERRM <> 'service_org_mismatch' THEN
        RAISE;
      END IF;
      v_failed := true;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'katalog organisasi lain tidak ditolak';
  END IF;

  SELECT statement, mt_status
  INTO v_statement, v_status
  FROM public.thinking_master_thoughts
  WHERE id = v_master;

  IF v_statement <> 'Tetap kalimat' OR v_status <> 'locked' THEN
    RAISE EXCEPTION 'penolakan katalog mengubah master';
  END IF;

  INSERT INTO public.thinking_big_thoughts (
    id, organization_id, master_thought_id, code, title, statement, status
  ) VALUES (
    v_thought, v_org, v_master, 'BT1', 'Big', 'Big uji', 'locked'
  );

  INSERT INTO public.thinking_lab_territories (
    id, organization_id, big_thought_id, code, statement, canonical_semantic, admission
  ) VALUES (
    v_territory, v_org, v_thought, 'TR1', 'Territory uji', '{}'::jsonb, 'GENERATE_VALID'
  );

  INSERT INTO public.thinking_lab_angles (
    id, organization_id, territory_id, code, statement, parent_territory_fingerprint,
    canonical_semantic, admission, status
  ) VALUES (
    v_angle, v_org, v_territory, 'AN02', 'Perlindungan', 'fp', '{}'::jsonb, 'GENERATE_VALID', 'locked'
  );

  IF (
    SELECT item->>'service_id'
    FROM jsonb_array_elements(public.ai_employee_angle_options(v_org, '{}'::uuid[])) item
    WHERE item->>'id' = v_angle::text
  ) IS DISTINCT FROM v_service::text THEN
    RAISE EXCEPTION 'daftar angle tidak membawa katalog parent';
  END IF;
END;
$test$;

ROLLBACK;
