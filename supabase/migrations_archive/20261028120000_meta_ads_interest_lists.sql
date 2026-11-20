-- Saved Meta Ads interest research lists (per organization). No global Meta catalog.

CREATE TABLE IF NOT EXISTS public.meta_ads_interest_lists (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meta_ads_interest_lists_name_nonempty CHECK (char_length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_meta_ads_interest_lists_org
  ON public.meta_ads_interest_lists (organization_id, updated_at DESC);

COMMENT ON TABLE public.meta_ads_interest_lists IS
  'User-saved Meta targeting interest lists for Interest Research workspace.';

CREATE TABLE IF NOT EXISTS public.meta_ads_interest_list_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id uuid NOT NULL REFERENCES public.meta_ads_interest_lists (id) ON DELETE CASCADE,
  meta_targeting_id text NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'interest',
  path jsonb NOT NULL DEFAULT '[]'::jsonb,
  audience_size_lower bigint NULL,
  audience_size_upper bigint NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meta_ads_interest_list_items_targeting_id_nonempty
    CHECK (char_length(trim(meta_targeting_id)) > 0),
  CONSTRAINT meta_ads_interest_list_items_unique_in_list
    UNIQUE (list_id, meta_targeting_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_ads_interest_list_items_list
  ON public.meta_ads_interest_list_items (list_id, sort_order);

COMMENT ON TABLE public.meta_ads_interest_list_items IS
  'Items inside a saved Meta interest research list.';

ALTER TABLE public.meta_ads_interest_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ads_interest_list_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meta_ads_interest_lists_select ON public.meta_ads_interest_lists;
CREATE POLICY meta_ads_interest_lists_select
  ON public.meta_ads_interest_lists
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.active_organization_id
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id IS NOT NULL
    )
    AND public.is_omnichannel_survey_settings_admin(organization_id)
  );

DROP POLICY IF EXISTS meta_ads_interest_lists_insert ON public.meta_ads_interest_lists;
CREATE POLICY meta_ads_interest_lists_insert
  ON public.meta_ads_interest_lists
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT p.active_organization_id
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id IS NOT NULL
    )
    AND public.is_omnichannel_survey_settings_admin(organization_id)
  );

DROP POLICY IF EXISTS meta_ads_interest_lists_update ON public.meta_ads_interest_lists;
CREATE POLICY meta_ads_interest_lists_update
  ON public.meta_ads_interest_lists
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.active_organization_id
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id IS NOT NULL
    )
    AND public.is_omnichannel_survey_settings_admin(organization_id)
  )
  WITH CHECK (
    organization_id IN (
      SELECT p.active_organization_id
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id IS NOT NULL
    )
    AND public.is_omnichannel_survey_settings_admin(organization_id)
  );

DROP POLICY IF EXISTS meta_ads_interest_lists_delete ON public.meta_ads_interest_lists;
CREATE POLICY meta_ads_interest_lists_delete
  ON public.meta_ads_interest_lists
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT p.active_organization_id
      FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.active_organization_id IS NOT NULL
    )
    AND public.is_omnichannel_survey_settings_admin(organization_id)
  );

DROP POLICY IF EXISTS meta_ads_interest_list_items_select ON public.meta_ads_interest_list_items;
CREATE POLICY meta_ads_interest_list_items_select
  ON public.meta_ads_interest_list_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.meta_ads_interest_lists l
      WHERE l.id = list_id
        AND l.organization_id IN (
          SELECT p.active_organization_id
          FROM public.profiles p
          WHERE p.user_id = (SELECT auth.uid())
            AND p.active_organization_id IS NOT NULL
        )
        AND public.is_omnichannel_survey_settings_admin(l.organization_id)
    )
  );

DROP POLICY IF EXISTS meta_ads_interest_list_items_insert ON public.meta_ads_interest_list_items;
CREATE POLICY meta_ads_interest_list_items_insert
  ON public.meta_ads_interest_list_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.meta_ads_interest_lists l
      WHERE l.id = list_id
        AND l.organization_id IN (
          SELECT p.active_organization_id
          FROM public.profiles p
          WHERE p.user_id = (SELECT auth.uid())
            AND p.active_organization_id IS NOT NULL
        )
        AND public.is_omnichannel_survey_settings_admin(l.organization_id)
    )
  );

DROP POLICY IF EXISTS meta_ads_interest_list_items_update ON public.meta_ads_interest_list_items;
CREATE POLICY meta_ads_interest_list_items_update
  ON public.meta_ads_interest_list_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.meta_ads_interest_lists l
      WHERE l.id = list_id
        AND l.organization_id IN (
          SELECT p.active_organization_id
          FROM public.profiles p
          WHERE p.user_id = (SELECT auth.uid())
            AND p.active_organization_id IS NOT NULL
        )
        AND public.is_omnichannel_survey_settings_admin(l.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.meta_ads_interest_lists l
      WHERE l.id = list_id
        AND l.organization_id IN (
          SELECT p.active_organization_id
          FROM public.profiles p
          WHERE p.user_id = (SELECT auth.uid())
            AND p.active_organization_id IS NOT NULL
        )
        AND public.is_omnichannel_survey_settings_admin(l.organization_id)
    )
  );

DROP POLICY IF EXISTS meta_ads_interest_list_items_delete ON public.meta_ads_interest_list_items;
CREATE POLICY meta_ads_interest_list_items_delete
  ON public.meta_ads_interest_list_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.meta_ads_interest_lists l
      WHERE l.id = list_id
        AND l.organization_id IN (
          SELECT p.active_organization_id
          FROM public.profiles p
          WHERE p.user_id = (SELECT auth.uid())
            AND p.active_organization_id IS NOT NULL
        )
        AND public.is_omnichannel_survey_settings_admin(l.organization_id)
    )
  );

DROP TRIGGER IF EXISTS update_meta_ads_interest_lists_updated_at
  ON public.meta_ads_interest_lists;
CREATE TRIGGER update_meta_ads_interest_lists_updated_at
  BEFORE UPDATE ON public.meta_ads_interest_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
