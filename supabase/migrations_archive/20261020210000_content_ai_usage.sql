CREATE TABLE IF NOT EXISTS public.content_ai_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  social_media_plan_id uuid NULL REFERENCES public.social_media_plans (id) ON DELETE CASCADE,
  actor_user_id uuid NULL,
  service text NOT NULL CHECK (service IN ('voice', 'video', 'image', 'script')),
  action text NOT NULL,
  target_label text NULL,
  model text NULL,
  usage_amount integer NULL,
  usage_unit text NULL,
  status text NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  provider_ref text NULL,
  source_id uuid NULL,
  prompt_excerpt text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_ai_usage_amount_pair CHECK (
    (usage_amount IS NULL AND usage_unit IS NULL)
    OR (usage_amount IS NOT NULL AND usage_amount >= 0 AND usage_unit IN ('character', 'token'))
  )
);

CREATE INDEX IF NOT EXISTS idx_content_ai_usage_plan
  ON public.content_ai_usage USING btree (social_media_plan_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_content_ai_usage_source
  ON public.content_ai_usage (service, source_id)
  WHERE source_id IS NOT NULL;

ALTER TABLE public.content_ai_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own org content ai usage" ON public.content_ai_usage;
CREATE POLICY "Users can view own org content ai usage"
  ON public.content_ai_usage FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
  );

REVOKE ALL ON TABLE public.content_ai_usage FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.content_ai_usage TO authenticated;
GRANT ALL ON TABLE public.content_ai_usage TO service_role;

COMMENT ON TABLE public.content_ai_usage IS
  'Official provider usage for one content. usage_amount is null when the provider did not return a number. social_media_plan_id is null until a script call is saved onto a content.';
COMMENT ON COLUMN public.content_ai_usage.usage_amount IS
  'Exact provider quantity: ElevenLabs character-cost, or Gemini/OpenAI/Seedance total tokens. Never a local estimate.';

INSERT INTO public.content_ai_usage (
  organization_id, social_media_plan_id, created_at, service, action, target_label,
  usage_amount, usage_unit, status, source_id, prompt_excerpt
)
SELECT
  c.organization_id,
  c.social_media_plan_id,
  c.created_at,
  'voice',
  CASE WHEN c.kind = 'seedance' THEN 'sts' ELSE 'vo' END,
  'Baris ' || (c.row_index + 1)::text,
  c.credit_cost,
  CASE WHEN c.credit_cost IS NULL THEN NULL ELSE 'character' END,
  'succeeded',
  c.id,
  NULLIF(left(btrim(regexp_replace(coalesce(c.spoken_text, ''), '\s+', ' ', 'g')), 160), '')
FROM public.brief_voice_clips c
WHERE NOT EXISTS (
  SELECT 1 FROM public.content_ai_usage u
  WHERE u.service = 'voice' AND u.source_id = c.id
);

INSERT INTO public.content_ai_usage (
  organization_id, social_media_plan_id, created_at, service, action, target_label,
  model, status, source_id
)
SELECT
  v.organization_id,
  v.social_media_plan_id,
  v.created_at,
  'video',
  CASE WHEN v.scope = 'master' THEN 'generate_master' ELSE 'generate_shot' END,
  (CASE WHEN v.scope = 'master' THEN 'Master' ELSE 'Baris ' || (v.row_index + 1)::text END)
    || ' · ' || v.duration_seconds::text || ' dtk · ' || v.resolution,
  v.model,
  CASE WHEN v.status IN ('queued', 'running', 'succeeded', 'failed') THEN v.status ELSE 'failed' END,
  v.id
FROM public.brief_shot_videos v
WHERE NOT EXISTS (
  SELECT 1 FROM public.content_ai_usage u
  WHERE u.service = 'video' AND u.source_id = v.id
);
