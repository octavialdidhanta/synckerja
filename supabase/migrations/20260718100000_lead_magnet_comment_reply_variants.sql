-- Multi-variant public comment replies + toggle
ALTER TABLE public.lead_magnet_campaigns
  ADD COLUMN IF NOT EXISTS comment_reply_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS comment_reply_texts text[] NOT NULL DEFAULT '{}';

UPDATE public.lead_magnet_campaigns
SET comment_reply_texts = ARRAY[comment_reply_text]
WHERE comment_reply_text IS NOT NULL
  AND btrim(comment_reply_text) <> ''
  AND (comment_reply_texts IS NULL OR comment_reply_texts = '{}');

ALTER TABLE public.lead_magnet_enrollments
  ADD COLUMN IF NOT EXISTS comment_reply_sent_text text NULL;

COMMENT ON COLUMN public.lead_magnet_campaigns.comment_reply_enabled IS
  'When true, auto-reply publicly under matched comments using comment_reply_texts variants.';
COMMENT ON COLUMN public.lead_magnet_campaigns.comment_reply_texts IS
  'Up to 3 public comment reply variants; runtime picks one at random among non-empty entries.';
COMMENT ON COLUMN public.lead_magnet_enrollments.comment_reply_sent_text IS
  'Final public reply text sent (after @mention), for Manage Comments preview.';
