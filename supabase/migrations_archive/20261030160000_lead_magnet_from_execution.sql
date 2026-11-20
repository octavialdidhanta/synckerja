-- Link one Lead Magnet draft to a social media plan, and store a per-org Claude key for PDF material only.

ALTER TABLE public.lead_magnet_campaigns
  ADD COLUMN IF NOT EXISTS social_media_plan_id uuid NULL
  REFERENCES public.social_media_plans (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_lead_magnet_campaigns_social_media_plan
  ON public.lead_magnet_campaigns (social_media_plan_id)
  WHERE social_media_plan_id IS NOT NULL;

COMMENT ON COLUMN public.lead_magnet_campaigns.social_media_plan_id IS
  'Content plan this draft was prepared from. One campaign per plan. Null for campaigns created in the wizard.';

ALTER TABLE public.organization_script_ai_config
  ADD COLUMN IF NOT EXISTS claude_api_key text NULL,
  ADD COLUMN IF NOT EXISTS claude_api_key_configured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS claude_model text NOT NULL DEFAULT 'claude-sonnet-4-5',
  ADD COLUMN IF NOT EXISTS claude_pdf_daily_limit integer NOT NULL DEFAULT 20;

ALTER TABLE public.organization_script_ai_config
  DROP CONSTRAINT IF EXISTS chk_organization_script_ai_config_claude_pdf_daily_limit;

ALTER TABLE public.organization_script_ai_config
  ADD CONSTRAINT chk_organization_script_ai_config_claude_pdf_daily_limit
  CHECK (claude_pdf_daily_limit >= 1 AND claude_pdf_daily_limit <= 200);

COMMENT ON COLUMN public.organization_script_ai_config.claude_api_key IS
  'Anthropic API key for Lead Magnet PDF generation. Not a Script Generator text provider.';
COMMENT ON COLUMN public.organization_script_ai_config.claude_model IS
  'Claude model id used only for Lead Magnet outline and PDF.';
COMMENT ON COLUMN public.organization_script_ai_config.claude_pdf_daily_limit IS
  'Max successful Lead Magnet PDFs per organization per day. Does not consume script_ai_daily_usage.';

CREATE TABLE IF NOT EXISTS public.claude_pdf_daily_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  usage_date date NOT NULL,
  count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_claude_pdf_daily_usage_org_date UNIQUE (organization_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_claude_pdf_daily_usage_org_date
  ON public.claude_pdf_daily_usage (organization_id, usage_date);

DROP TRIGGER IF EXISTS trigger_claude_pdf_daily_usage_updated_at ON public.claude_pdf_daily_usage;
CREATE TRIGGER trigger_claude_pdf_daily_usage_updated_at
  BEFORE UPDATE ON public.claude_pdf_daily_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.claude_pdf_daily_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own org claude pdf usage" ON public.claude_pdf_daily_usage;
CREATE POLICY "Users can view own org claude pdf usage"
  ON public.claude_pdf_daily_usage FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.active_organization_id = claude_pdf_daily_usage.organization_id
    )
  );

COMMENT ON TABLE public.claude_pdf_daily_usage IS
  'Daily count of successful Claude PDFs for Lead Magnet. Separate from script_ai_daily_usage.';
