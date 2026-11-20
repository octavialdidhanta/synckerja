-- Automation Flow Builder: flows, enrollments, delay jobs, labels, run events, whatsapp_messages source.

-- ---------------------------------------------------------------------------
-- 1) omnichannel_automation_flows
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.omnichannel_automation_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CONSTRAINT omnichannel_automation_flows_status_chk
    CHECK (status IN ('draft', 'active', 'archived')),
  graph_json jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}'::jsonb,
  published_graph_json jsonb NULL,
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  re_enrollment_rule text NOT NULL DEFAULT 'not_in_flow'
    CONSTRAINT omnichannel_automation_flows_re_enroll_chk
    CHECK (re_enrollment_rule IN ('not_in_flow', 'never', 'always')),
  version integer NOT NULL DEFAULT 1,
  published_at timestamptz NULL,
  published_by_employee_id uuid NULL REFERENCES public.employees (id) ON DELETE SET NULL,
  created_by_employee_id uuid NULL REFERENCES public.employees (id) ON DELETE SET NULL,
  updated_by_employee_id uuid NULL REFERENCES public.employees (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_omnichannel_automation_flows_org_status
  ON public.omnichannel_automation_flows (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_omnichannel_automation_flows_org_updated
  ON public.omnichannel_automation_flows (organization_id, updated_at DESC);

COMMENT ON TABLE public.omnichannel_automation_flows IS
  'SleekFlow-style automation flows (triggers, conditions, actions). Distinct from Meta WhatsApp Form Flows.';

-- ---------------------------------------------------------------------------
-- 2) omnichannel_flow_enrollments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.omnichannel_flow_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  flow_id uuid NOT NULL REFERENCES public.omnichannel_automation_flows (id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp'
    CONSTRAINT omnichannel_flow_enrollments_channel_chk CHECK (channel IN ('whatsapp')),
  status text NOT NULL DEFAULT 'active'
    CONSTRAINT omnichannel_flow_enrollments_status_chk
    CHECK (status IN ('active', 'paused', 'waiting_for_reply', 'completed', 'failed')),
  current_node_id text NULL,
  context_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  paused_reason text NULL
    CONSTRAINT omnichannel_flow_enrollments_paused_chk
    CHECK (paused_reason IS NULL OR paused_reason IN ('assignee_taken_over', 'manual')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_omnichannel_flow_enrollments_active
  ON public.omnichannel_flow_enrollments (flow_id, conversation_id)
  WHERE status IN ('active', 'waiting_for_reply');

CREATE INDEX IF NOT EXISTS idx_omnichannel_flow_enrollments_org_flow
  ON public.omnichannel_flow_enrollments (organization_id, flow_id);

CREATE INDEX IF NOT EXISTS idx_omnichannel_flow_enrollments_conversation
  ON public.omnichannel_flow_enrollments (conversation_id);

-- ---------------------------------------------------------------------------
-- 3) omnichannel_flow_delay_jobs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.omnichannel_flow_delay_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.omnichannel_flow_enrollments (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  resume_at timestamptz NOT NULL,
  target_node_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CONSTRAINT omnichannel_flow_delay_jobs_status_chk
    CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_omnichannel_flow_delay_jobs_pending
  ON public.omnichannel_flow_delay_jobs (status, resume_at)
  WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- 4) Labels
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.omnichannel_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NULL DEFAULT '#6B7280',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT omnichannel_labels_org_name_unique UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS public.omnichannel_conversation_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL,
  label_id uuid NOT NULL REFERENCES public.omnichannel_labels (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT omnichannel_conversation_labels_unique UNIQUE (conversation_id, label_id)
);

CREATE INDEX IF NOT EXISTS idx_omnichannel_conversation_labels_conv
  ON public.omnichannel_conversation_labels (conversation_id);

-- ---------------------------------------------------------------------------
-- 5) Flow run events (debug / usage)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.omnichannel_flow_run_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  flow_id uuid NOT NULL REFERENCES public.omnichannel_automation_flows (id) ON DELETE CASCADE,
  enrollment_id uuid NULL REFERENCES public.omnichannel_flow_enrollments (id) ON DELETE SET NULL,
  event_type text NOT NULL,
  node_id text NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_omnichannel_flow_run_events_flow_created
  ON public.omnichannel_flow_run_events (flow_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 6) whatsapp_messages automation source
-- ---------------------------------------------------------------------------
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'agent'
    CONSTRAINT whatsapp_messages_source_chk
    CHECK (source IN ('agent', 'flow_automation', 'system'));

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS automation_flow_id uuid NULL
    REFERENCES public.omnichannel_automation_flows (id) ON DELETE SET NULL;

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS automation_enrollment_id uuid NULL
    REFERENCES public.omnichannel_flow_enrollments (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 7) Pause enrollments when assignee is set on conversation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pause_flow_enrollments_on_assignee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND (OLD.assignee_id IS NULL OR TRIM(COALESCE(OLD.assignee_id::text, '')) = '')
    AND NEW.assignee_id IS NOT NULL
    AND TRIM(NEW.assignee_id::text) <> ''
  THEN
    UPDATE public.omnichannel_flow_enrollments e
    SET
      status = 'paused',
      paused_reason = 'assignee_taken_over',
      updated_at = now()
    WHERE e.conversation_id = NEW.id
      AND e.status IN ('active', 'waiting_for_reply');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pause_flow_enrollments_on_assignee ON public.whatsapp_conversations;
CREATE TRIGGER trg_pause_flow_enrollments_on_assignee
  AFTER UPDATE OF assignee_id ON public.whatsapp_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.pause_flow_enrollments_on_assignee();

-- ---------------------------------------------------------------------------
-- 8) updated_at triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.omnichannel_automation_flows_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_omnichannel_automation_flows_updated ON public.omnichannel_automation_flows;
CREATE TRIGGER trg_omnichannel_automation_flows_updated
  BEFORE UPDATE ON public.omnichannel_automation_flows
  FOR EACH ROW EXECUTE FUNCTION public.omnichannel_automation_flows_set_updated_at();

CREATE OR REPLACE FUNCTION public.omnichannel_flow_enrollments_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_omnichannel_flow_enrollments_updated ON public.omnichannel_flow_enrollments;
CREATE TRIGGER trg_omnichannel_flow_enrollments_updated
  BEFORE UPDATE ON public.omnichannel_flow_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.omnichannel_flow_enrollments_set_updated_at();

-- ---------------------------------------------------------------------------
-- 9) RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.omnichannel_automation_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omnichannel_flow_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omnichannel_flow_delay_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omnichannel_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omnichannel_conversation_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omnichannel_flow_run_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "omnichannel_automation_flows_select_org" ON public.omnichannel_automation_flows;
CREATE POLICY "omnichannel_automation_flows_select_org"
  ON public.omnichannel_automation_flows FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "omnichannel_automation_flows_insert_org" ON public.omnichannel_automation_flows;
CREATE POLICY "omnichannel_automation_flows_insert_org"
  ON public.omnichannel_automation_flows FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "omnichannel_automation_flows_update_org" ON public.omnichannel_automation_flows;
CREATE POLICY "omnichannel_automation_flows_update_org"
  ON public.omnichannel_automation_flows FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "omnichannel_automation_flows_delete_org" ON public.omnichannel_automation_flows;
CREATE POLICY "omnichannel_automation_flows_delete_org"
  ON public.omnichannel_automation_flows FOR DELETE TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "omnichannel_flow_enrollments_select_org" ON public.omnichannel_flow_enrollments;
CREATE POLICY "omnichannel_flow_enrollments_select_org"
  ON public.omnichannel_flow_enrollments FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "omnichannel_labels_select_org" ON public.omnichannel_labels;
CREATE POLICY "omnichannel_labels_select_org"
  ON public.omnichannel_labels FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "omnichannel_labels_mutate_org" ON public.omnichannel_labels;
CREATE POLICY "omnichannel_labels_mutate_org"
  ON public.omnichannel_labels FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "omnichannel_conversation_labels_select_org" ON public.omnichannel_conversation_labels;
CREATE POLICY "omnichannel_conversation_labels_select_org"
  ON public.omnichannel_conversation_labels FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "omnichannel_conversation_labels_mutate_org" ON public.omnichannel_conversation_labels;
CREATE POLICY "omnichannel_conversation_labels_mutate_org"
  ON public.omnichannel_conversation_labels FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "omnichannel_flow_run_events_select_org" ON public.omnichannel_flow_run_events;
CREATE POLICY "omnichannel_flow_run_events_select_org"
  ON public.omnichannel_flow_run_events FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

-- ---------------------------------------------------------------------------
-- 10) pg_cron: flow delay worker (calls edge function via net.http_post when available)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_due_flow_delay_jobs(p_limit integer DEFAULT 50)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_job record;
BEGIN
  FOR v_job IN
    SELECT id
    FROM public.omnichannel_flow_delay_jobs
    WHERE status = 'pending' AND resume_at <= now()
    ORDER BY resume_at ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.omnichannel_flow_delay_jobs
    SET status = 'processing', updated_at = now()
    WHERE id = v_job.id AND status = 'pending';

    IF FOUND THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.process_due_flow_delay_jobs(integer) IS
  'Marks due delay jobs as processing. Edge function flow-delay-worker completes execution.';

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'flow-delay-worker-mark') THEN
      PERFORM cron.schedule(
        'flow-delay-worker-mark',
        '* * * * *',
        $cmd$SELECT public.process_due_flow_delay_jobs(50);$cmd$
      );
    END IF;
  END IF;
END
$cron$;
