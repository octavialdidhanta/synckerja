-- KPI targets for Google Ads on Digital Marketing Report (per account, custom metrics, monthly/quarterly).

CREATE TABLE public.google_ads_report_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  google_customer_id text NOT NULL,
  metric_key text NOT NULL,
  period_type text NOT NULL CHECK (period_type IN ('monthly', 'quarterly')),
  year int NOT NULL CHECK (year >= 2000 AND year <= 2100),
  month int CHECK (month IS NULL OR (month >= 1 AND month <= 12)),
  quarter int CHECK (quarter IS NULL OR (quarter >= 1 AND quarter <= 4)),
  target_value numeric NOT NULL CHECK (target_value >= 0),
  individual_objective_id uuid NULL REFERENCES public.individual_objectives(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gart_period_shape CHECK (
    (period_type = 'monthly' AND month IS NOT NULL AND quarter IS NULL) OR
    (period_type = 'quarterly' AND quarter IS NOT NULL AND month IS NULL)
  )
);

CREATE UNIQUE INDEX google_ads_report_targets_unique_monthly
  ON public.google_ads_report_targets (organization_id, google_customer_id, metric_key, year, month)
  WHERE period_type = 'monthly';

CREATE UNIQUE INDEX google_ads_report_targets_unique_quarterly
  ON public.google_ads_report_targets (organization_id, google_customer_id, metric_key, year, quarter)
  WHERE period_type = 'quarterly';

CREATE INDEX google_ads_report_targets_org_period_idx
  ON public.google_ads_report_targets (organization_id, period_type, year, month, quarter);

CREATE INDEX google_ads_report_targets_individual_objective_idx
  ON public.google_ads_report_targets (individual_objective_id)
  WHERE individual_objective_id IS NOT NULL;

COMMENT ON TABLE public.google_ads_report_targets IS
  'Google Ads KPI targets per customer account and metric key for Digital Marketing Report.';

ALTER TABLE public.google_ads_report_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY google_ads_report_targets_select
  ON public.google_ads_report_targets FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY google_ads_report_targets_insert
  ON public.google_ads_report_targets FOR INSERT TO authenticated
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));

CREATE POLICY google_ads_report_targets_update
  ON public.google_ads_report_targets FOR UPDATE TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id))
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));

CREATE POLICY google_ads_report_targets_delete
  ON public.google_ads_report_targets FOR DELETE TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id));

CREATE TRIGGER update_google_ads_report_targets_updated_at
  BEFORE UPDATE ON public.google_ads_report_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PIC per Google Ads account per period
CREATE TABLE public.google_ads_report_target_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  google_customer_id text NOT NULL,
  period_type text NOT NULL CHECK (period_type IN ('monthly', 'quarterly')),
  year int NOT NULL CHECK (year >= 2000 AND year <= 2100),
  month int CHECK (month IS NULL OR (month >= 1 AND month <= 12)),
  quarter int CHECK (quarter IS NULL OR (quarter >= 1 AND quarter <= 4)),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT garta_period_shape CHECK (
    (period_type = 'monthly' AND month IS NOT NULL AND quarter IS NULL) OR
    (period_type = 'quarterly' AND quarter IS NOT NULL AND month IS NULL)
  )
);

CREATE UNIQUE INDEX google_ads_report_target_assignments_unique_monthly
  ON public.google_ads_report_target_assignments (organization_id, google_customer_id, year, month)
  WHERE period_type = 'monthly';

CREATE UNIQUE INDEX google_ads_report_target_assignments_unique_quarterly
  ON public.google_ads_report_target_assignments (organization_id, google_customer_id, year, quarter)
  WHERE period_type = 'quarterly';

CREATE INDEX google_ads_report_target_assignments_org_period_idx
  ON public.google_ads_report_target_assignments (organization_id, period_type, year, month, quarter);

COMMENT ON TABLE public.google_ads_report_target_assignments IS
  'Per-account employee PIC for Google Ads Report KPI targets.';

ALTER TABLE public.google_ads_report_target_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY google_ads_report_target_assignments_select
  ON public.google_ads_report_target_assignments FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY google_ads_report_target_assignments_insert
  ON public.google_ads_report_target_assignments FOR INSERT TO authenticated
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));

CREATE POLICY google_ads_report_target_assignments_update
  ON public.google_ads_report_target_assignments FOR UPDATE TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id))
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));

CREATE POLICY google_ads_report_target_assignments_delete
  ON public.google_ads_report_target_assignments FOR DELETE TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id));

CREATE TRIGGER update_google_ads_report_target_assignments_updated_at
  BEFORE UPDATE ON public.google_ads_report_target_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Period settings: company objective, synced dept objective, selected metrics
CREATE TABLE public.google_ads_report_target_period_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_type text NOT NULL CHECK (period_type IN ('monthly', 'quarterly')),
  year int NOT NULL CHECK (year >= 2000 AND year <= 2100),
  month int CHECK (month IS NULL OR (month >= 1 AND month <= 12)),
  quarter int CHECK (quarter IS NULL OR (quarter >= 1 AND quarter <= 4)),
  company_objective_id uuid NULL REFERENCES public.company_objectives(id) ON DELETE RESTRICT,
  synced_department_objective_id uuid NULL REFERENCES public.department_objectives(id) ON DELETE SET NULL,
  selected_metrics text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gartps_period_shape CHECK (
    (period_type = 'monthly' AND month IS NOT NULL AND quarter IS NULL) OR
    (period_type = 'quarterly' AND quarter IS NOT NULL AND month IS NULL)
  )
);

CREATE UNIQUE INDEX google_ads_report_target_period_settings_unique_monthly
  ON public.google_ads_report_target_period_settings (organization_id, year, month)
  WHERE period_type = 'monthly';

CREATE UNIQUE INDEX google_ads_report_target_period_settings_unique_quarterly
  ON public.google_ads_report_target_period_settings (organization_id, year, quarter)
  WHERE period_type = 'quarterly';

COMMENT ON TABLE public.google_ads_report_target_period_settings IS
  'Per-period Company Objective, selected metric keys, and synced department objective for Google Ads KPI targets.';

ALTER TABLE public.google_ads_report_target_period_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY google_ads_report_target_period_settings_select
  ON public.google_ads_report_target_period_settings FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

CREATE POLICY google_ads_report_target_period_settings_insert
  ON public.google_ads_report_target_period_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));

CREATE POLICY google_ads_report_target_period_settings_update
  ON public.google_ads_report_target_period_settings FOR UPDATE TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id))
  WITH CHECK (public.is_omnichannel_survey_settings_admin(organization_id));

CREATE POLICY google_ads_report_target_period_settings_delete
  ON public.google_ads_report_target_period_settings FOR DELETE TO authenticated
  USING (public.is_omnichannel_survey_settings_admin(organization_id));

CREATE TRIGGER update_google_ads_report_target_period_settings_updated_at
  BEFORE UPDATE ON public.google_ads_report_target_period_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
