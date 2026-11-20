ALTER TABLE public.brief_voice_clips
  ADD COLUMN IF NOT EXISTS credit_cost integer NULL;

ALTER TABLE public.brief_voice_clips
  DROP CONSTRAINT IF EXISTS brief_voice_clips_credit_cost_nonnegative;

ALTER TABLE public.brief_voice_clips
  ADD CONSTRAINT brief_voice_clips_credit_cost_nonnegative
  CHECK (credit_cost IS NULL OR credit_cost >= 0);

COMMENT ON COLUMN public.brief_voice_clips.credit_cost IS
  'Exact ElevenLabs character-cost response header for this generation. Null when the API did not return it. Never a local character-count estimate.';
