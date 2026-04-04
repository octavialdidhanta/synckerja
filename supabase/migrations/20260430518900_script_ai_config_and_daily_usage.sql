-- Script AI: per-org Gemini config + daily usage counters.
-- Used by Edge Functions: generate-script-ai, detect-digital-asset-image.
-- Prerequisites: public.organizations, public.profiles, public.update_updated_at_column().

-- ---------------------------------------------------------------------------
-- organization_script_ai_config
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_script_ai_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  google_ai_api_key text NULL,
  api_key_configured boolean NULL DEFAULT false,
  daily_limit integer NULL DEFAULT 50,
  model text NULL DEFAULT 'gemini-2.5-flash',
  is_active boolean NULL DEFAULT false,
  created_at timestamptz NULL DEFAULT now(),
  updated_at timestamptz NULL DEFAULT now(),
  CONSTRAINT uq_organization_script_ai_config UNIQUE (organization_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_script_ai_config_organization_id
  ON public.organization_script_ai_config USING btree (organization_id);

DROP TRIGGER IF EXISTS trigger_organization_script_ai_config_updated_at ON public.organization_script_ai_config;
CREATE TRIGGER trigger_organization_script_ai_config_updated_at
  BEFORE UPDATE ON public.organization_script_ai_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.organization_script_ai_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own org script ai config" ON public.organization_script_ai_config;
CREATE POLICY "Users can view own org script ai config"
  ON public.organization_script_ai_config FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = organization_script_ai_config.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can insert own org script ai config" ON public.organization_script_ai_config;
CREATE POLICY "Users can insert own org script ai config"
  ON public.organization_script_ai_config FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = organization_id
    )
  );

DROP POLICY IF EXISTS "Users can update own org script ai config" ON public.organization_script_ai_config;
CREATE POLICY "Users can update own org script ai config"
  ON public.organization_script_ai_config FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = organization_script_ai_config.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = organization_id
    )
  );

DROP POLICY IF EXISTS "Users can delete own org script ai config" ON public.organization_script_ai_config;
CREATE POLICY "Users can delete own org script ai config"
  ON public.organization_script_ai_config FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = organization_script_ai_config.organization_id
    )
  );

COMMENT ON TABLE public.organization_script_ai_config IS 'Per-tenant Google Gemini API config for Script Generator. API key stored server-side; Edge Functions read with service role.';

-- ---------------------------------------------------------------------------
-- script_ai_daily_usage
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.script_ai_daily_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  usage_date date NOT NULL,
  count integer NULL DEFAULT 0,
  created_at timestamptz NULL DEFAULT now(),
  updated_at timestamptz NULL DEFAULT now(),
  CONSTRAINT uq_script_ai_daily_usage_org_date UNIQUE (organization_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_script_ai_daily_usage_organization_id
  ON public.script_ai_daily_usage USING btree (organization_id);

CREATE INDEX IF NOT EXISTS idx_script_ai_daily_usage_org_date
  ON public.script_ai_daily_usage USING btree (organization_id, usage_date);

DROP TRIGGER IF EXISTS trigger_script_ai_daily_usage_updated_at ON public.script_ai_daily_usage;
CREATE TRIGGER trigger_script_ai_daily_usage_updated_at
  BEFORE UPDATE ON public.script_ai_daily_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.script_ai_daily_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own org script ai usage" ON public.script_ai_daily_usage;
CREATE POLICY "Users can view own org script ai usage"
  ON public.script_ai_daily_usage FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = script_ai_daily_usage.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can insert own org script ai usage" ON public.script_ai_daily_usage;
CREATE POLICY "Users can insert own org script ai usage"
  ON public.script_ai_daily_usage FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = organization_id
    )
  );

DROP POLICY IF EXISTS "Users can update own org script ai usage" ON public.script_ai_daily_usage;
CREATE POLICY "Users can update own org script ai usage"
  ON public.script_ai_daily_usage FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = script_ai_daily_usage.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = organization_id
    )
  );

COMMENT ON TABLE public.script_ai_daily_usage IS 'Daily usage count for Script Generator / detect-digital-asset-image rate limiting.';
