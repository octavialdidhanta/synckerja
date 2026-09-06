-- Tag FCM tokens by native app package so Omnichannel livechat pushes target Office only.
-- Old livechat rows cannot tell Office vs POS (same Firebase project) → wipe livechat; Office re-registers on next launch.

ALTER TABLE public.fcm_tokens
  ADD COLUMN IF NOT EXISTS app_id text NOT NULL DEFAULT 'id.synckerja.app';

ALTER TABLE public.fcm_tokens
  DROP CONSTRAINT IF EXISTS fcm_tokens_app_id_chk;

ALTER TABLE public.fcm_tokens
  ADD CONSTRAINT fcm_tokens_app_id_chk
  CHECK (app_id IN ('id.synckerja.app', 'id.synckerja.pos'));

DROP INDEX IF EXISTS public.fcm_tokens_user_id_token_context_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS fcm_tokens_user_id_token_context_app_uidx
  ON public.fcm_tokens (user_id, token, context, app_id);

CREATE INDEX IF NOT EXISTS fcm_tokens_context_app_id_idx
  ON public.fcm_tokens (context, app_id);

DELETE FROM public.fcm_tokens WHERE context = 'livechat';

COMMENT ON COLUMN public.fcm_tokens.app_id IS
  'Native package id: id.synckerja.app (Office) or id.synckerja.pos (POS). Livechat pushes only target Office.';
