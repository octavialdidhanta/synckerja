-- Track assignment actor on Instagram + Messenger conversations (mirrors whatsapp_conversations).

ALTER TABLE public.instagram_conversations
  ADD COLUMN IF NOT EXISTS last_assigned_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.instagram_conversations
  ADD COLUMN IF NOT EXISTS last_assigned_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_instagram_conversations_last_assigned_by_user_id
  ON public.instagram_conversations (last_assigned_by_user_id)
  WHERE last_assigned_by_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_instagram_conversations_last_assigned_at
  ON public.instagram_conversations (last_assigned_at DESC NULLS LAST);

COMMENT ON COLUMN public.instagram_conversations.last_assigned_by_user_id IS
  'Auth user_id who last changed assignee_id (for assignment push + audit).';

COMMENT ON COLUMN public.instagram_conversations.last_assigned_at IS
  'Timestamp of the last assignee_id change (for assignment push freshness/debugging).';

ALTER TABLE public.facebook_conversations
  ADD COLUMN IF NOT EXISTS last_assigned_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.facebook_conversations
  ADD COLUMN IF NOT EXISTS last_assigned_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_facebook_conversations_last_assigned_by_user_id
  ON public.facebook_conversations (last_assigned_by_user_id)
  WHERE last_assigned_by_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_facebook_conversations_last_assigned_at
  ON public.facebook_conversations (last_assigned_at DESC NULLS LAST);

COMMENT ON COLUMN public.facebook_conversations.last_assigned_by_user_id IS
  'Auth user_id who last changed assignee_id (for assignment push + audit).';

COMMENT ON COLUMN public.facebook_conversations.last_assigned_at IS
  'Timestamp of the last assignee_id change (for assignment push freshness/debugging).';
