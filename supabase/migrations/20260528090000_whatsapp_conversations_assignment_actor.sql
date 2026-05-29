-- Track assignment actor for push notification routing.
-- Needed to support "skip self-assign" (actor == assignee).

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS last_assigned_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS last_assigned_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_last_assigned_by_user_id
  ON public.whatsapp_conversations (last_assigned_by_user_id)
  WHERE last_assigned_by_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_last_assigned_at
  ON public.whatsapp_conversations (last_assigned_at DESC NULLS LAST);

COMMENT ON COLUMN public.whatsapp_conversations.last_assigned_by_user_id IS
  'Auth user_id who last changed assignee_id (for assignment push + audit).';

COMMENT ON COLUMN public.whatsapp_conversations.last_assigned_at IS
  'Timestamp of the last assignee_id change (for assignment push freshness/debugging).';

