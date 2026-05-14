-- Omnichannel SLA: org config + audit, first_assignee anchor per cycle, IG/email cycle tables (mirror WA).

-- ---------------------------------------------------------------------------
-- 1) organization_omnichannel_sla (one row per org, both minutes NOT NULL)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_omnichannel_sla (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  first_response_sla_minutes integer NOT NULL DEFAULT 15
    CONSTRAINT organization_omnichannel_sla_first_chk CHECK (first_response_sla_minutes > 0),
  resolution_sla_minutes integer NOT NULL DEFAULT 1440
    CONSTRAINT organization_omnichannel_sla_res_chk CHECK (resolution_sla_minutes > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

COMMENT ON TABLE public.organization_omnichannel_sla IS
  'Per-org SLA targets (24x7 calendar). first_response: from first assignee in cycle; resolution: from first_response_at.';

INSERT INTO public.organization_omnichannel_sla (organization_id, first_response_sla_minutes, resolution_sla_minutes)
SELECT o.id, 15, 1440
FROM public.organizations o
ON CONFLICT (organization_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2) Audit log (append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_omnichannel_sla_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  changed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  old_row jsonb,
  new_row jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_omnichannel_sla_audit_org_created
  ON public.organization_omnichannel_sla_audit (organization_id, created_at DESC);

-- Trigger: log updates to organization_omnichannel_sla
CREATE OR REPLACE FUNCTION public.organization_omnichannel_sla_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.first_response_sla_minutes IS DISTINCT FROM NEW.first_response_sla_minutes
      OR OLD.resolution_sla_minutes IS DISTINCT FROM NEW.resolution_sla_minutes) THEN
    INSERT INTO public.organization_omnichannel_sla_audit (organization_id, changed_by, old_row, new_row)
    VALUES (
      NEW.organization_id,
      NEW.updated_by,
      jsonb_build_object(
        'first_response_sla_minutes', OLD.first_response_sla_minutes,
        'resolution_sla_minutes', OLD.resolution_sla_minutes
      ),
      jsonb_build_object(
        'first_response_sla_minutes', NEW.first_response_sla_minutes,
        'resolution_sla_minutes', NEW.resolution_sla_minutes
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_organization_omnichannel_sla_audit ON public.organization_omnichannel_sla;
CREATE TRIGGER trg_organization_omnichannel_sla_audit
  AFTER UPDATE ON public.organization_omnichannel_sla
  FOR EACH ROW
  EXECUTE FUNCTION public.organization_omnichannel_sla_audit_trigger();

ALTER TABLE public.organization_omnichannel_sla ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_omnichannel_sla_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "organization_omnichannel_sla_select_org" ON public.organization_omnichannel_sla;
CREATE POLICY "organization_omnichannel_sla_select_org"
  ON public.organization_omnichannel_sla FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "organization_omnichannel_sla_insert_owner_admin" ON public.organization_omnichannel_sla;
CREATE POLICY "organization_omnichannel_sla_insert_owner_admin"
  ON public.organization_omnichannel_sla FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND (
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
          AND ur.organization_id = organization_omnichannel_sla.organization_id
          AND ur.role IN ('owner', 'admin')
      )
      OR EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = organization_omnichannel_sla.organization_id
          AND (o.user_id = (SELECT auth.uid()) OR o.created_by = (SELECT auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS "organization_omnichannel_sla_update_owner_admin" ON public.organization_omnichannel_sla;
CREATE POLICY "organization_omnichannel_sla_update_owner_admin"
  ON public.organization_omnichannel_sla FOR UPDATE TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND (
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
          AND ur.organization_id = organization_omnichannel_sla.organization_id
          AND ur.role IN ('owner', 'admin')
      )
      OR EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = organization_omnichannel_sla.organization_id
          AND (o.user_id = (SELECT auth.uid()) OR o.created_by = (SELECT auth.uid()))
      )
    )
  )
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND (
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
          AND ur.organization_id = organization_omnichannel_sla.organization_id
          AND ur.role IN ('owner', 'admin')
      )
      OR EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = organization_omnichannel_sla.organization_id
          AND (o.user_id = (SELECT auth.uid()) OR o.created_by = (SELECT auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS "organization_omnichannel_sla_audit_select_org" ON public.organization_omnichannel_sla_audit;
CREATE POLICY "organization_omnichannel_sla_audit_select_org"
  ON public.organization_omnichannel_sla_audit FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "organization_omnichannel_sla_audit_insert_owner_admin" ON public.organization_omnichannel_sla_audit;
CREATE POLICY "organization_omnichannel_sla_audit_insert_owner_admin"
  ON public.organization_omnichannel_sla_audit FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND (
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
          AND ur.organization_id = organization_omnichannel_sla_audit.organization_id
          AND ur.role IN ('owner', 'admin')
      )
      OR EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = organization_omnichannel_sla_audit.organization_id
          AND (o.user_id = (SELECT auth.uid()) OR o.created_by = (SELECT auth.uid()))
      )
    )
  );

GRANT SELECT ON public.organization_omnichannel_sla TO authenticated;
GRANT INSERT, UPDATE ON public.organization_omnichannel_sla TO authenticated;
GRANT SELECT, INSERT ON public.organization_omnichannel_sla_audit TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) WhatsApp cycles: first_assignee_in_cycle_at
-- ---------------------------------------------------------------------------
ALTER TABLE public.whatsapp_conversation_cycles
  ADD COLUMN IF NOT EXISTS first_assignee_in_cycle_at timestamptz;

COMMENT ON COLUMN public.whatsapp_conversation_cycles.first_assignee_in_cycle_at IS
  'First time assignee became non-null during this open cycle; SLA first-response due is anchored here.';

CREATE OR REPLACE FUNCTION public.whatsapp_conversations_set_cycle_first_assignee()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.assignee_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.assignee_id IS NOT DISTINCT FROM NEW.assignee_id THEN
    RETURN NEW;
  END IF;
  UPDATE public.whatsapp_conversation_cycles cy
  SET
    first_assignee_in_cycle_at = now(),
    updated_at = now()
  WHERE cy.conversation_id = NEW.id
    AND cy.resolved_at IS NULL
    AND cy.first_assignee_in_cycle_at IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_conversations_set_cycle_first_assignee ON public.whatsapp_conversations;
CREATE TRIGGER trg_whatsapp_conversations_set_cycle_first_assignee
  AFTER INSERT OR UPDATE OF assignee_id ON public.whatsapp_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.whatsapp_conversations_set_cycle_first_assignee();

-- Historical backfill: approximate anchor for cycles where conv still has assignee (legacy accuracy caveat)
UPDATE public.whatsapp_conversation_cycles cy
SET first_assignee_in_cycle_at = cy.cycle_started_at
WHERE cy.first_assignee_in_cycle_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.whatsapp_conversations c
    WHERE c.id = cy.conversation_id AND c.assignee_id IS NOT NULL
  );

-- ---------------------------------------------------------------------------
-- 4) Instagram conversation cycles (native instagram_conversations table)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.instagram_conversation_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.instagram_conversations (id) ON DELETE CASCADE,
  cycle_started_at timestamptz NOT NULL,
  first_assignee_in_cycle_at timestamptz,
  first_response_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instagram_conversation_cycles_conversation_id
  ON public.instagram_conversation_cycles (conversation_id);
CREATE INDEX IF NOT EXISTS idx_instagram_conversation_cycles_resolved_at
  ON public.instagram_conversation_cycles (resolved_at) WHERE resolved_at IS NOT NULL;

COMMENT ON TABLE public.instagram_conversation_cycles IS 'Mirror whatsapp_conversation_cycles for Instagram DM (instagram_conversations).';

ALTER TABLE public.instagram_conversation_cycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "instagram_conversation_cycles_select" ON public.instagram_conversation_cycles;
CREATE POLICY "instagram_conversation_cycles_select"
  ON public.instagram_conversation_cycles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.instagram_conversations c
      JOIN public.profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = instagram_conversation_cycles.conversation_id
    )
  );

DROP POLICY IF EXISTS "instagram_conversation_cycles_insert" ON public.instagram_conversation_cycles;
CREATE POLICY "instagram_conversation_cycles_insert"
  ON public.instagram_conversation_cycles FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.instagram_conversations c
      JOIN public.profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = instagram_conversation_cycles.conversation_id
    )
  );

DROP POLICY IF EXISTS "instagram_conversation_cycles_update" ON public.instagram_conversation_cycles;
CREATE POLICY "instagram_conversation_cycles_update"
  ON public.instagram_conversation_cycles FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.instagram_conversations c
      JOIN public.profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = instagram_conversation_cycles.conversation_id
    )
  );

CREATE OR REPLACE FUNCTION public.update_instagram_conversation_cycles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_instagram_conversation_cycles_updated_at ON public.instagram_conversation_cycles;
CREATE TRIGGER trigger_instagram_conversation_cycles_updated_at
  BEFORE UPDATE ON public.instagram_conversation_cycles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_instagram_conversation_cycles_updated_at();

CREATE OR REPLACE FUNCTION public.instagram_conversations_set_cycle_first_assignee()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.assignee_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.assignee_id IS NOT DISTINCT FROM NEW.assignee_id THEN
    RETURN NEW;
  END IF;
  UPDATE public.instagram_conversation_cycles cy
  SET first_assignee_in_cycle_at = now(), updated_at = now()
  WHERE cy.conversation_id = NEW.id
    AND cy.resolved_at IS NULL
    AND cy.first_assignee_in_cycle_at IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_instagram_conversations_set_cycle_first_assignee ON public.instagram_conversations;
CREATE TRIGGER trg_instagram_conversations_set_cycle_first_assignee
  AFTER INSERT OR UPDATE OF assignee_id ON public.instagram_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.instagram_conversations_set_cycle_first_assignee();

GRANT SELECT, INSERT, UPDATE ON public.instagram_conversation_cycles TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) Email: assignee on conversation (for SLA anchor + send guard; synced from lead in app)
-- ---------------------------------------------------------------------------
ALTER TABLE public.email_conversations
  ADD COLUMN IF NOT EXISTS assignee_id uuid REFERENCES public.employees (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_conversations_assignee_id
  ON public.email_conversations (assignee_id)
  WHERE assignee_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 6) Email conversation cycles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_conversation_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.email_conversations (id) ON DELETE CASCADE,
  cycle_started_at timestamptz NOT NULL,
  first_assignee_in_cycle_at timestamptz,
  first_response_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_conversation_cycles_conversation_id
  ON public.email_conversation_cycles (conversation_id);

ALTER TABLE public.email_conversation_cycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_conversation_cycles_select" ON public.email_conversation_cycles;
CREATE POLICY "email_conversation_cycles_select"
  ON public.email_conversation_cycles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.email_conversations c
      JOIN public.profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = email_conversation_cycles.conversation_id
    )
  );

DROP POLICY IF EXISTS "email_conversation_cycles_insert" ON public.email_conversation_cycles;
CREATE POLICY "email_conversation_cycles_insert"
  ON public.email_conversation_cycles FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.email_conversations c
      JOIN public.profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = email_conversation_cycles.conversation_id
    )
  );

DROP POLICY IF EXISTS "email_conversation_cycles_update" ON public.email_conversation_cycles;
CREATE POLICY "email_conversation_cycles_update"
  ON public.email_conversation_cycles FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.email_conversations c
      JOIN public.profiles p ON p.active_organization_id = c.organization_id AND p.user_id = auth.uid()
      WHERE c.id = email_conversation_cycles.conversation_id
    )
  );

CREATE OR REPLACE FUNCTION public.update_email_conversation_cycles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_email_conversation_cycles_updated_at ON public.email_conversation_cycles;
CREATE TRIGGER trigger_email_conversation_cycles_updated_at
  BEFORE UPDATE ON public.email_conversation_cycles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_email_conversation_cycles_updated_at();

CREATE OR REPLACE FUNCTION public.email_conversations_set_cycle_first_assignee()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.assignee_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.assignee_id IS NOT DISTINCT FROM NEW.assignee_id THEN
    RETURN NEW;
  END IF;
  UPDATE public.email_conversation_cycles cy
  SET first_assignee_in_cycle_at = now(), updated_at = now()
  WHERE cy.conversation_id = NEW.id
    AND cy.resolved_at IS NULL
    AND cy.first_assignee_in_cycle_at IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_conversations_set_cycle_first_assignee ON public.email_conversations;
CREATE TRIGGER trg_email_conversations_set_cycle_first_assignee
  AFTER INSERT OR UPDATE OF assignee_id ON public.email_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.email_conversations_set_cycle_first_assignee();

GRANT SELECT, INSERT, UPDATE ON public.email_conversation_cycles TO authenticated;
