-- CRM core: lead_statuses, lead_sources, leads, lead_client_profiles, lead_status_history, lead_follow_up_updates
-- + trigger functions aligned with synckerja-reference / app (sales.ts uses status_id, lead_status_history, etc.)
--
-- Runs BEFORE 20260430530000_operations_crm_reference_bundle.sql so lead_statuses/leads exist for FKs in that bundle.
--
-- Prerequisites: public.organizations, public.employees, public.profiles, auth.users
--
-- Adjustments vs raw reference DDL:
--   - FK leads.status_id -> lead_statuses(id) ON DELETE SET NULL
--   - FK lead_sources.organization_id -> organizations
--   - FK lead_status_history.organization_id -> organizations; changed_by -> auth.users
--   - Completed update_leads_updated_at trigger (was truncated in paste)
--   - sync_follow_up_priority_* + trigger_sync_follow_up_priority inlined (required by lead_follow_up_updates trigger)
--   - Omitted separate update_lead_followup_count triggers (redundant with trigger_sync_follow_up_priority)
--   - conversation_id FK on lead_follow_up_updates / lead_status_history only when whatsapp_conversations exists
--   - RLS policies (org-scoped; lead_statuses readable when organization_id IS NULL)
--
-- Safe to re-run: IF NOT EXISTS, DROP TRIGGER IF EXISTS, CREATE OR REPLACE, EXCEPTION where noted.

-- ---------------------------------------------------------------------------
-- Helper: updated_at for lead_client_profiles
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_lead_client_profiles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- leads: updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_leads_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Tables (FK order) — before functions that reference these tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_statuses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NULL,
  color text NULL DEFAULT '#6B7280',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NULL DEFAULT 0,
  organization_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  CONSTRAINT lead_statuses_pkey PRIMARY KEY (id),
  CONSTRAINT lead_statuses_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations (id)
);

CREATE TABLE IF NOT EXISTS public.lead_sources (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NULL,
  is_active boolean NOT NULL DEFAULT true,
  organization_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  CONSTRAINT lead_sources_pkey PRIMARY KEY (id),
  CONSTRAINT lead_sources_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations (id)
);

CREATE TABLE IF NOT EXISTS public.leads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ticket_id text NOT NULL DEFAULT (
    ('LEAD-' || to_char(now(), 'YYYYMMDD')) || '-' ||
    lpad((floor(random() * 9999))::text, 4, '0')
  ),
  client text NOT NULL,
  title text NOT NULL,
  category text NOT NULL,
  created_by uuid NOT NULL,
  created_by_name text NOT NULL,
  assignee text NOT NULL,
  followup integer NULL DEFAULT 0,
  fu_priority text NULL DEFAULT 'Please Follow Up',
  source text NULL DEFAULT 'Website',
  organization_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  services text NULL,
  converted_at timestamptz NULL,
  status_id uuid NULL,
  assignee_id uuid NULL,
  phone_number text NULL,
  email text NULL,
  CONSTRAINT leads_pkey PRIMARY KEY (id),
  CONSTRAINT leads_ticket_id_key UNIQUE (ticket_id),
  CONSTRAINT leads_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES public.employees (id) ON DELETE SET NULL,
  CONSTRAINT leads_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations (id),
  CONSTRAINT leads_fu_priority_check CHECK (
    fu_priority = ANY (ARRAY['High'::text, 'Medium'::text, 'Low'::text, 'Please Follow Up'::text])
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leads_status_id_fkey' AND conrelid = 'public.leads'::regclass
  ) THEN
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_status_id_fkey
      FOREIGN KEY (status_id) REFERENCES public.lead_statuses (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_status_id ON public.leads USING btree (status_id);
CREATE INDEX IF NOT EXISTS idx_leads_assignee_id ON public.leads USING btree (assignee_id);
CREATE INDEX IF NOT EXISTS idx_leads_organization_id ON public.leads USING btree (organization_id);

CREATE TABLE IF NOT EXISTS public.lead_client_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  name text NOT NULL,
  gender text NULL,
  age integer NULL,
  occupation text NULL,
  location text NULL,
  organization_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  code text NULL,
  contact_person text NULL,
  contact_email text NULL,
  contact_phone text NULL,
  industry text NULL,
  notes text NULL,
  is_active boolean NULL DEFAULT true,
  phone_number text NULL,
  email text NULL,
  CONSTRAINT lead_client_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT lead_client_profiles_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads (id) ON DELETE CASCADE,
  CONSTRAINT lead_client_profiles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations (id),
  CONSTRAINT lead_client_profiles_age_check CHECK (age > 0 AND age < 150),
  CONSTRAINT lead_client_profiles_gender_check CHECK (
    gender = ANY (ARRAY['Male'::text, 'Female'::text, 'Other'::text])
  )
);

CREATE INDEX IF NOT EXISTS idx_lead_client_profiles_lead_id ON public.lead_client_profiles USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_client_profiles_organization_id ON public.lead_client_profiles USING btree (organization_id);

CREATE TABLE IF NOT EXISTS public.lead_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  old_status text NULL,
  new_status text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid NULL,
  changed_by_name text NULL,
  notes text NULL,
  organization_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_status_history_pkey PRIMARY KEY (id),
  CONSTRAINT fk_lead_status_history_lead FOREIGN KEY (lead_id) REFERENCES public.leads (id) ON DELETE CASCADE,
  CONSTRAINT lead_status_history_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE,
  CONSTRAINT lead_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_lead_status_history_lead_id ON public.lead_status_history USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_status_history_changed_at ON public.lead_status_history USING btree (changed_at);
CREATE INDEX IF NOT EXISTS idx_lead_status_history_new_status ON public.lead_status_history USING btree (new_status);
CREATE INDEX IF NOT EXISTS idx_lead_status_history_organization_id ON public.lead_status_history USING btree (organization_id);

-- conversation_id on lead_follow_up_updates + lead_status_history: added (with FK) in 20260430530000.
-- Trigger bodies reference conversation_id before that migration; skip body validation at create time.

CREATE TABLE IF NOT EXISTS public.lead_follow_up_updates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  update_details text NOT NULL,
  status text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  created_by_name text NOT NULL,
  organization_id uuid NOT NULL,
  CONSTRAINT lead_follow_up_updates_pkey PRIMARY KEY (id),
  CONSTRAINT lead_follow_up_updates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users (id),
  CONSTRAINT lead_follow_up_updates_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads (id) ON DELETE CASCADE,
  CONSTRAINT lead_follow_up_updates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations (id)
);

CREATE INDEX IF NOT EXISTS idx_lead_follow_up_updates_lead_id ON public.lead_follow_up_updates USING btree (lead_id);

-- ---------------------------------------------------------------------------
-- Trigger functions (after tables exist)
-- ---------------------------------------------------------------------------
SET check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.update_lead_converted_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_name text;
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.status_id IS DISTINCT FROM NEW.status_id) AND NEW.status_id IS NOT NULL THEN
    SELECT LOWER(TRIM(name)) INTO new_name FROM public.lead_statuses WHERE id = NEW.status_id;
    IF new_name = 'converted' THEN
      NEW.converted_at := COALESCE(NEW.converted_at, NOW());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.track_lead_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_name text;
  new_name text;
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.status_id IS DISTINCT FROM NEW.status_id) THEN
    SELECT name INTO old_name FROM public.lead_statuses WHERE id = OLD.status_id;
    SELECT name INTO new_name FROM public.lead_statuses WHERE id = NEW.status_id;
    INSERT INTO public.lead_status_history (
      lead_id,
      old_status,
      new_status,
      organization_id,
      changed_by
    ) VALUES (
      NEW.id,
      old_name,
      COALESCE(new_name, ''),
      NEW.organization_id,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_follow_up_priority_for_conversation(p_conv_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hot_cnt int;
  warm_cnt int;
  cold_cnt int;
  total_cnt int;
  fp text;
BEGIN
  IF p_conv_id IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'whatsapp_conversations'
  ) THEN
    RETURN;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE LOWER(TRIM(REGEXP_REPLACE(COALESCE(status, ''), '\s+', ' ', 'g'))) = 'hot prospect'),
    COUNT(*) FILTER (WHERE LOWER(TRIM(REGEXP_REPLACE(COALESCE(status, ''), '\s+', ' ', 'g'))) = 'warm prospect'),
    COUNT(*) FILTER (WHERE LOWER(TRIM(REGEXP_REPLACE(COALESCE(status, ''), '\s+', ' ', 'g'))) = 'cold prospect'),
    COUNT(*)
  INTO hot_cnt, warm_cnt, cold_cnt, total_cnt
  FROM public.lead_follow_up_updates
  WHERE conversation_id = p_conv_id;

  IF total_cnt = 0 THEN fp := NULL;
  ELSIF (hot_cnt::float / total_cnt) >= (warm_cnt::float / total_cnt) AND (hot_cnt::float / total_cnt) >= (cold_cnt::float / total_cnt) AND hot_cnt > 0 THEN fp := 'High';
  ELSIF (warm_cnt::float / total_cnt) >= (hot_cnt::float / total_cnt) AND (warm_cnt::float / total_cnt) >= (cold_cnt::float / total_cnt) AND warm_cnt > 0 THEN fp := 'Medium';
  ELSIF cold_cnt > 0 THEN fp := 'Low';
  ELSE fp := NULL;
  END IF;

  UPDATE public.whatsapp_conversations
  SET followup = total_cnt, fu_priority = fp, updated_at = NOW()
  WHERE id = p_conv_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_follow_up_priority_for_lead(p_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hot_cnt int;
  warm_cnt int;
  cold_cnt int;
  total_cnt int;
  fp text;
BEGIN
  IF p_lead_id IS NULL THEN RETURN; END IF;

  SELECT
    COUNT(*) FILTER (WHERE LOWER(TRIM(REGEXP_REPLACE(COALESCE(status, ''), '\s+', ' ', 'g'))) = 'hot prospect'),
    COUNT(*) FILTER (WHERE LOWER(TRIM(REGEXP_REPLACE(COALESCE(status, ''), '\s+', ' ', 'g'))) = 'warm prospect'),
    COUNT(*) FILTER (WHERE LOWER(TRIM(REGEXP_REPLACE(COALESCE(status, ''), '\s+', ' ', 'g'))) = 'cold prospect'),
    COUNT(*)
  INTO hot_cnt, warm_cnt, cold_cnt, total_cnt
  FROM public.lead_follow_up_updates
  WHERE lead_id = p_lead_id;

  IF total_cnt = 0 THEN fp := NULL;
  ELSIF (hot_cnt::float / total_cnt) >= (warm_cnt::float / total_cnt) AND (hot_cnt::float / total_cnt) >= (cold_cnt::float / total_cnt) AND hot_cnt > 0 THEN fp := 'High';
  ELSIF (warm_cnt::float / total_cnt) >= (hot_cnt::float / total_cnt) AND (warm_cnt::float / total_cnt) >= (cold_cnt::float / total_cnt) AND warm_cnt > 0 THEN fp := 'Medium';
  ELSIF cold_cnt > 0 THEN fp := 'Low';
  ELSE fp := NULL;
  END IF;

  UPDATE public.leads
  SET followup = total_cnt, fu_priority = fp, updated_at = NOW()
  WHERE id = p_lead_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_sync_follow_up_priority()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_follow_up_priority_for_conversation(OLD.conversation_id);
    PERFORM public.sync_follow_up_priority_for_lead(OLD.lead_id);
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM public.sync_follow_up_priority_for_conversation(NEW.conversation_id);
    PERFORM public.sync_follow_up_priority_for_lead(NEW.lead_id);
    RETURN NEW;
  ELSE
    PERFORM public.sync_follow_up_priority_for_conversation(NEW.conversation_id);
    PERFORM public.sync_follow_up_priority_for_conversation(OLD.conversation_id);
    PERFORM public.sync_follow_up_priority_for_lead(NEW.lead_id);
    PERFORM public.sync_follow_up_priority_for_lead(OLD.lead_id);
    RETURN NEW;
  END IF;
END;
$$;

SET check_function_bodies = on;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_leads_updated_at ON public.leads;
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_leads_updated_at();

DROP TRIGGER IF EXISTS update_lead_converted_at_trigger ON public.leads;
CREATE TRIGGER update_lead_converted_at_trigger
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_lead_converted_at();

DROP TRIGGER IF EXISTS track_lead_status_change_trigger ON public.leads;
CREATE TRIGGER track_lead_status_change_trigger
  AFTER UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.track_lead_status_change();

DROP TRIGGER IF EXISTS sync_fu_priority_after_lead_follow_up_updates ON public.lead_follow_up_updates;
CREATE TRIGGER sync_fu_priority_after_lead_follow_up_updates
  AFTER INSERT OR UPDATE OR DELETE ON public.lead_follow_up_updates
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_sync_follow_up_priority();

DROP TRIGGER IF EXISTS update_lead_client_profiles_updated_at ON public.lead_client_profiles;
CREATE TRIGGER update_lead_client_profiles_updated_at
  BEFORE UPDATE ON public.lead_client_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_lead_client_profiles_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.lead_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_client_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_follow_up_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_statuses_select_org" ON public.lead_statuses;
CREATE POLICY "lead_statuses_select_org"
  ON public.lead_statuses FOR SELECT
  USING (
    organization_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = lead_statuses.organization_id
    )
  );

DROP POLICY IF EXISTS "lead_statuses_mutate_org" ON public.lead_statuses;
CREATE POLICY "lead_statuses_mutate_org"
  ON public.lead_statuses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = lead_statuses.organization_id
    )
  );

DROP POLICY IF EXISTS "lead_statuses_update_org" ON public.lead_statuses;
CREATE POLICY "lead_statuses_update_org"
  ON public.lead_statuses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = lead_statuses.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = lead_statuses.organization_id
    )
  );

DROP POLICY IF EXISTS "lead_statuses_delete_org" ON public.lead_statuses;
CREATE POLICY "lead_statuses_delete_org"
  ON public.lead_statuses FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = lead_statuses.organization_id
    )
  );

DROP POLICY IF EXISTS "lead_sources_org" ON public.lead_sources;
CREATE POLICY "lead_sources_org"
  ON public.lead_sources FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = lead_sources.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = lead_sources.organization_id
    )
  );

DROP POLICY IF EXISTS "leads_org" ON public.leads;
CREATE POLICY "leads_org"
  ON public.leads FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = leads.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = leads.organization_id
    )
  );

DROP POLICY IF EXISTS "lead_client_profiles_org" ON public.lead_client_profiles;
CREATE POLICY "lead_client_profiles_org"
  ON public.lead_client_profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = lead_client_profiles.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = lead_client_profiles.organization_id
    )
  );

DROP POLICY IF EXISTS "lead_follow_up_updates_org" ON public.lead_follow_up_updates;
CREATE POLICY "lead_follow_up_updates_org"
  ON public.lead_follow_up_updates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = lead_follow_up_updates.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = lead_follow_up_updates.organization_id
    )
  );

ALTER TABLE public.lead_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own org lead status history" ON public.lead_status_history;
CREATE POLICY "Users can view own org lead status history"
  ON public.lead_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = lead_status_history.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can insert own org lead status history" ON public.lead_status_history;
CREATE POLICY "Users can insert own org lead status history"
  ON public.lead_status_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = lead_status_history.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can update own org lead status history" ON public.lead_status_history;
CREATE POLICY "Users can update own org lead status history"
  ON public.lead_status_history FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = lead_status_history.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = lead_status_history.organization_id
    )
  );

DROP POLICY IF EXISTS "Users can delete own org lead status history" ON public.lead_status_history;
CREATE POLICY "Users can delete own org lead status history"
  ON public.lead_status_history FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.active_organization_id = lead_status_history.organization_id
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE public.leads IS 'CRM leads; Operations / Leads Management.';
COMMENT ON TABLE public.lead_statuses IS 'Pipeline statuses; organization_id NULL = global defaults readable by all orgs.';
COMMENT ON TABLE public.lead_sources IS 'Lead sources per organization.';
