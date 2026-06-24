-- Load test seed: 50 orgs × 5 TikTok schedules = 250 due rows (dry-run only).
-- Run cleanup.sql before re-seeding.

SELECT public.cleanup_social_media_load_test_rows();

DO $$
DECLARE
  org_rec record;
  i integer;
  v_plan_id uuid;
  v_org_count integer := 0;
BEGIN
  FOR org_rec IN
    SELECT id
    FROM public.organizations
    ORDER BY created_at
    LIMIT 50
  LOOP
    v_org_count := v_org_count + 1;

    FOR i IN 1..5 LOOP
      INSERT INTO public.social_media_plans (
        organization_id,
        title,
        approved,
        production_approved,
        post_date,
        google_drive_link,
        status
      )
      VALUES (
        org_rec.id,
        '[LOAD_TEST] org ' || v_org_count || ' post ' || i,
        true,
        true,
        now(),
        'load-test://video',
        'approved'
      )
      RETURNING id INTO v_plan_id;

      INSERT INTO public.social_media_scheduled_posts (
        organization_id,
        social_media_plan_id,
        platform,
        delivery_mode,
        status,
        scheduled_at,
        timezone,
        media_source,
        media_url_snapshot,
        caption,
        title,
        privacy_level,
        provider_config
      )
      VALUES (
        org_rec.id,
        v_plan_id,
        'TikTok',
        'api_auto',
        'pending',
        now(),
        'Asia/Jakarta',
        'google_drive_link',
        'load-test://video',
        'load test caption',
        '[LOAD_TEST]',
        'SELF_ONLY',
        jsonb_build_object('load_test', true, 'open_id', 'load_test_open_id', 'account_label', 'Load Test')
      );
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Seeded load test for % organizations (target 50)', v_org_count;
END $$;

SELECT
  count(*) AS load_test_pending_due
FROM public.social_media_scheduled_posts
WHERE (provider_config->>'load_test') = 'true'
  AND status = 'pending'
  AND scheduled_at <= now();
