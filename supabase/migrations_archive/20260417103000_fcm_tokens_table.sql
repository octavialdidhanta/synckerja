-- FCM device tokens (native app). Used by livechat-save-fcm-token, livechat-send-push, attendance-reminder-send.
-- Idempotent: safe if table already exists from manual setup.

CREATE TABLE IF NOT EXISTS public.fcm_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL,
  context text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fcm_tokens_platform_chk CHECK (platform IN ('android', 'ios')),
  CONSTRAINT fcm_tokens_context_chk CHECK (context IN ('livechat', 'general'))
);

CREATE UNIQUE INDEX IF NOT EXISTS fcm_tokens_user_id_token_context_uidx
  ON public.fcm_tokens (user_id, token, context);

CREATE INDEX IF NOT EXISTS fcm_tokens_user_id_context_idx
  ON public.fcm_tokens (user_id, context);

ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Optional: user read own rows (edge functions use service_role and bypass RLS).
DROP POLICY IF EXISTS "fcm_tokens_select_own" ON public.fcm_tokens;
CREATE POLICY "fcm_tokens_select_own" ON public.fcm_tokens
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE public.fcm_tokens IS 'FCM tokens per user/device/context; written by livechat-save-fcm-token (service role upsert after auth).';
