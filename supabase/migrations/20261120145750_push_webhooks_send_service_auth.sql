-- Push-notification webhooks: send the service-role key with every call so the Edge Functions
-- can refuse anonymous callers (they currently accept requests from anyone on the internet).
--
-- Replaces supabase_functions.http_request (static headers, no auth) on 4 triggers with
-- public.edge_push_webhook(), which builds the SAME payload (old_record, record, type, table,
-- schema) and adds Authorization from Supabase Vault. The key is never written in trigger
-- arguments or code (see the 2026-11-20 incident where a service_role JWT sat in a trigger).
--
-- Rollout order (no missed notifications):
--   1. this migration: triggers start sending the key (functions still accept anything)
--   2. deploy the functions with the isAuthorizedServiceCaller check
--
-- Safe to re-run.

CREATE OR REPLACE FUNCTION public.edge_push_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  v_fn text := TG_ARGV[0];
  v_timeout integer := COALESCE(NULLIF(TG_ARGV[1], '')::integer, 10000);
  v_url text;
  v_key text;
  v_request_id bigint;
BEGIN
  IF v_fn IS NULL OR v_fn !~ '^[a-z0-9-]+$' THEN
    RAISE LOG 'edge_push_webhook: invalid function name %', v_fn;
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets
  WHERE name = 'google_ads_scheduler_project_url' LIMIT 1;
  IF v_url IS NULL OR v_url = '' THEN
    v_url := 'https://wqdzqqshoifwyrltzgvx.supabase.co';
  END IF;

  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets
  WHERE name = 'google_ads_scheduler_service_role_key' LIMIT 1;
  IF v_key IS NULL OR v_key = '' THEN
    SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets
    WHERE name = 'tiktok_scheduler_service_role_key' LIMIT 1;
  END IF;

  IF v_key IS NULL OR v_key = '' THEN
    -- Never block the row write because of a missing secret; the push is just skipped.
    RAISE LOG 'edge_push_webhook: missing Vault service key, skipped %', v_fn;
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/' || v_fn,
    body := jsonb_build_object(
      'old_record', OLD,
      'record', NEW,
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA
    ),
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key,
      'apikey', v_key
    ),
    timeout_milliseconds := v_timeout
  ) INTO v_request_id;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

REVOKE ALL ON FUNCTION public.edge_push_webhook() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.edge_push_webhook() FROM anon, authenticated;

-- Same events and timeouts as before; only the function they call changes.
DROP TRIGGER IF EXISTS daily_task_completion_push_queue_insert ON public.daily_task_completion_push_queue;
CREATE TRIGGER daily_task_completion_push_queue_insert
  AFTER INSERT ON public.daily_task_completion_push_queue
  FOR EACH ROW EXECUTE FUNCTION public.edge_push_webhook('daily-task-completion-send-push', '5000');

DROP TRIGGER IF EXISTS daily_task_assignment_push ON public.daily_task_assignment_push_queue;
CREATE TRIGGER daily_task_assignment_push
  AFTER INSERT ON public.daily_task_assignment_push_queue
  FOR EACH ROW EXECUTE FUNCTION public.edge_push_webhook('daily-task-comment-send-push', '10000');

DROP TRIGGER IF EXISTS social_media_production_push_queue_insert ON public.social_media_production_push_queue;
CREATE TRIGGER social_media_production_push_queue_insert
  AFTER INSERT ON public.social_media_production_push_queue
  FOR EACH ROW EXECUTE FUNCTION public.edge_push_webhook('social-media-production-send-push', '10000');

DROP TRIGGER IF EXISTS wa_assignment_push ON public.whatsapp_conversations;
CREATE TRIGGER wa_assignment_push
  AFTER UPDATE ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION public.edge_push_webhook('livechat-assignment-send-push', '10000');
