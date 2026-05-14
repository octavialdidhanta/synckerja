-- Omnichannel staff roster: org + employee + role (agent | supervisor | admin).
-- RLS: org members read; owner/admin write. Assignee on leads/WA/IG must be on roster when set.

CREATE TABLE IF NOT EXISTS public.organization_omnichannel_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role = ANY (ARRAY['agent'::text, 'supervisor'::text, 'admin'::text])),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_omnichannel_staff_org_employee_key UNIQUE (organization_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_omnichannel_staff_org
  ON public.organization_omnichannel_staff (organization_id);

CREATE INDEX IF NOT EXISTS idx_organization_omnichannel_staff_employee
  ON public.organization_omnichannel_staff (employee_id);

COMMENT ON TABLE public.organization_omnichannel_staff IS 'Employees (with user_id) allowed as omnichannel agents; billing add-on count = row count per org.';

-- updated_at
CREATE OR REPLACE FUNCTION public.set_organization_omnichannel_staff_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_organization_omnichannel_staff_updated_at ON public.organization_omnichannel_staff;
CREATE TRIGGER trg_organization_omnichannel_staff_updated_at
  BEFORE UPDATE ON public.organization_omnichannel_staff
  FOR EACH ROW
  EXECUTE FUNCTION public.set_organization_omnichannel_staff_updated_at();

-- Employee must belong to org and have user_id (login-capable).
CREATE OR REPLACE FUNCTION public.organization_omnichannel_staff_validate_employee()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = NEW.employee_id
      AND e.organization_id = NEW.organization_id
      AND e.user_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Omnichannel roster: employee must belong to organization and have user_id';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_organization_omnichannel_staff_validate_employee ON public.organization_omnichannel_staff;
CREATE TRIGGER trg_organization_omnichannel_staff_validate_employee
  BEFORE INSERT OR UPDATE OF organization_id, employee_id ON public.organization_omnichannel_staff
  FOR EACH ROW
  EXECUTE FUNCTION public.organization_omnichannel_staff_validate_employee();

-- Assignee must be on roster when non-null (leads / WA / IG).
CREATE OR REPLACE FUNCTION public.enforce_assignee_on_omnichannel_roster()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  aid uuid;
  oid uuid;
BEGIN
  aid := NEW.assignee_id;
  IF aid IS NULL THEN
    RETURN NEW;
  END IF;

  oid := NEW.organization_id;
  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_omnichannel_staff s
    WHERE s.organization_id = oid
      AND s.employee_id = aid
  ) THEN
    RAISE EXCEPTION 'Assignee must be on omnichannel staff roster for this organization';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_assignee_omnichannel_roster ON public.leads;
CREATE TRIGGER trg_leads_assignee_omnichannel_roster
  BEFORE INSERT OR UPDATE OF assignee_id, organization_id ON public.leads
  FOR EACH ROW
  WHEN (NEW.assignee_id IS NOT NULL)
  EXECUTE FUNCTION public.enforce_assignee_on_omnichannel_roster();

DROP TRIGGER IF EXISTS trg_whatsapp_conversations_assignee_omnichannel_roster ON public.whatsapp_conversations;
CREATE TRIGGER trg_whatsapp_conversations_assignee_omnichannel_roster
  BEFORE INSERT OR UPDATE OF assignee_id, organization_id ON public.whatsapp_conversations
  FOR EACH ROW
  WHEN (NEW.assignee_id IS NOT NULL)
  EXECUTE FUNCTION public.enforce_assignee_on_omnichannel_roster();

DROP TRIGGER IF EXISTS trg_instagram_conversations_assignee_omnichannel_roster ON public.instagram_conversations;
CREATE TRIGGER trg_instagram_conversations_assignee_omnichannel_roster
  BEFORE INSERT OR UPDATE OF assignee_id, organization_id ON public.instagram_conversations
  FOR EACH ROW
  WHEN (NEW.assignee_id IS NOT NULL)
  EXECUTE FUNCTION public.enforce_assignee_on_omnichannel_roster();

-- Block removing roster row while still assigned on lead or conversation.
CREATE OR REPLACE FUNCTION public.organization_omnichannel_staff_block_delete_if_assigned()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  oid uuid := OLD.organization_id;
  eid uuid := OLD.employee_id;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.organization_id = oid AND l.assignee_id = eid
  ) THEN
    RAISE EXCEPTION 'Cannot remove omnichannel staff while assigned to a lead';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.whatsapp_conversations c
    WHERE c.organization_id = oid AND c.assignee_id = eid
  ) THEN
    RAISE EXCEPTION 'Cannot remove omnichannel staff while assigned to a WhatsApp conversation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.instagram_conversations c
    WHERE c.organization_id = oid AND c.assignee_id = eid
  ) THEN
    RAISE EXCEPTION 'Cannot remove omnichannel staff while assigned to an Instagram conversation';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_organization_omnichannel_staff_block_delete_if_assigned ON public.organization_omnichannel_staff;
CREATE TRIGGER trg_organization_omnichannel_staff_block_delete_if_assigned
  BEFORE DELETE ON public.organization_omnichannel_staff
  FOR EACH ROW
  EXECUTE FUNCTION public.organization_omnichannel_staff_block_delete_if_assigned();

-- Backfill roster from existing assignees so legacy rows stay valid.
INSERT INTO public.organization_omnichannel_staff (organization_id, employee_id, role)
SELECT DISTINCT l.organization_id, l.assignee_id, 'agent'::text
FROM public.leads l
WHERE l.assignee_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = l.assignee_id
      AND e.organization_id = l.organization_id
      AND e.user_id IS NOT NULL
  )
ON CONFLICT (organization_id, employee_id) DO NOTHING;

INSERT INTO public.organization_omnichannel_staff (organization_id, employee_id, role)
SELECT DISTINCT c.organization_id, c.assignee_id, 'agent'::text
FROM public.whatsapp_conversations c
WHERE c.assignee_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = c.assignee_id
      AND e.organization_id = c.organization_id
      AND e.user_id IS NOT NULL
  )
ON CONFLICT (organization_id, employee_id) DO NOTHING;

INSERT INTO public.organization_omnichannel_staff (organization_id, employee_id, role)
SELECT DISTINCT c.organization_id, c.assignee_id, 'agent'::text
FROM public.instagram_conversations c
WHERE c.assignee_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = c.assignee_id
      AND e.organization_id = c.organization_id
      AND e.user_id IS NOT NULL
  )
ON CONFLICT (organization_id, employee_id) DO NOTHING;

ALTER TABLE public.organization_omnichannel_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "organization_omnichannel_staff_select_org" ON public.organization_omnichannel_staff;
CREATE POLICY "organization_omnichannel_staff_select_org"
  ON public.organization_omnichannel_staff
  FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "organization_omnichannel_staff_insert_owner_admin" ON public.organization_omnichannel_staff;
CREATE POLICY "organization_omnichannel_staff_insert_owner_admin"
  ON public.organization_omnichannel_staff
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.organization_id = organization_omnichannel_staff.organization_id
        AND ur.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "organization_omnichannel_staff_update_owner_admin" ON public.organization_omnichannel_staff;
CREATE POLICY "organization_omnichannel_staff_update_owner_admin"
  ON public.organization_omnichannel_staff
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.organization_id = organization_omnichannel_staff.organization_id
        AND ur.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.organization_id = organization_omnichannel_staff.organization_id
        AND ur.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "organization_omnichannel_staff_delete_owner_admin" ON public.organization_omnichannel_staff;
CREATE POLICY "organization_omnichannel_staff_delete_owner_admin"
  ON public.organization_omnichannel_staff
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.organization_id = organization_omnichannel_staff.organization_id
        AND ur.role IN ('owner', 'admin')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_omnichannel_staff TO authenticated;
