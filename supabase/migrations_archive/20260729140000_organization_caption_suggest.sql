-- Caption suggest: org curated @handles and #hashtags for Share-to-Publish.

CREATE TABLE IF NOT EXISTS public.organization_caption_mention_handles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  handle TEXT NOT NULL,
  display_name TEXT,
  platform TEXT NOT NULL DEFAULT 'instagram',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT organization_caption_mention_handles_handle_nonempty
    CHECK (char_length(trim(handle)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_org_caption_mention_handle_lower
  ON public.organization_caption_mention_handles (organization_id, lower(handle));

CREATE INDEX IF NOT EXISTS idx_org_caption_mention_handles_org
  ON public.organization_caption_mention_handles (organization_id)
  WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS public.organization_caption_hashtags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT organization_caption_hashtags_tag_nonempty
    CHECK (char_length(trim(tag)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_org_caption_hashtag_lower
  ON public.organization_caption_hashtags (organization_id, lower(tag));

CREATE INDEX IF NOT EXISTS idx_org_caption_hashtags_org
  ON public.organization_caption_hashtags (organization_id)
  WHERE is_active = TRUE;

ALTER TABLE public.organization_caption_mention_handles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_caption_hashtags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org caption mention handles"
  ON public.organization_caption_mention_handles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = organization_caption_mention_handles.organization_id
    )
  );

CREATE POLICY "Users can insert own org caption mention handles"
  ON public.organization_caption_mention_handles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = organization_id
    )
  );

CREATE POLICY "Users can update own org caption mention handles"
  ON public.organization_caption_mention_handles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = organization_caption_mention_handles.organization_id
    )
  );

CREATE POLICY "Users can delete own org caption mention handles"
  ON public.organization_caption_mention_handles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = organization_caption_mention_handles.organization_id
    )
  );

CREATE POLICY "Users can view own org caption hashtags"
  ON public.organization_caption_hashtags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = organization_caption_hashtags.organization_id
    )
  );

CREATE POLICY "Users can insert own org caption hashtags"
  ON public.organization_caption_hashtags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = organization_id
    )
  );

CREATE POLICY "Users can update own org caption hashtags"
  ON public.organization_caption_hashtags FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = organization_caption_hashtags.organization_id
    )
  );

CREATE POLICY "Users can delete own org caption hashtags"
  ON public.organization_caption_hashtags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = organization_caption_hashtags.organization_id
    )
  );

CREATE OR REPLACE FUNCTION public.update_organization_caption_mention_handles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_organization_caption_hashtags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_organization_caption_mention_handles_updated_at
  ON public.organization_caption_mention_handles;
CREATE TRIGGER trigger_organization_caption_mention_handles_updated_at
  BEFORE UPDATE ON public.organization_caption_mention_handles
  FOR EACH ROW EXECUTE FUNCTION public.update_organization_caption_mention_handles_updated_at();

DROP TRIGGER IF EXISTS trigger_organization_caption_hashtags_updated_at
  ON public.organization_caption_hashtags;
CREATE TRIGGER trigger_organization_caption_hashtags_updated_at
  BEFORE UPDATE ON public.organization_caption_hashtags
  FOR EACH ROW EXECUTE FUNCTION public.update_organization_caption_hashtags_updated_at();

COMMENT ON TABLE public.organization_caption_mention_handles IS
  'Curated social @handles for Share-to-Publish caption autocomplete.';
COMMENT ON TABLE public.organization_caption_hashtags IS
  'Curated hashtags (without #) for Share-to-Publish caption suggestions.';
