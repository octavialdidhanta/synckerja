-- SLA Management: work schedules, policies, conditions (multi-policy per org).
-- Backfill default policy from organization_omnichannel_sla; legacy table kept for audit/sync.

-- ---------------------------------------------------------------------------
-- 1) Work schedule (one row per org for V1; Mon–Fri default window)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_sla_work_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations (id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'Asia/Jakarta',
  weekly_rules jsonb NOT NULL DEFAULT '[
    {"dow":1,"open":"09:00","close":"17:00"},
    {"dow":2,"open":"09:00","close":"17:00"},
    {"dow":3,"open":"09:00","close":"17:00"},
    {"dow":4,"open":"09:00","close":"17:00"},
    {"dow":5,"open":"09:00","close":"17:00"}
  ]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.organization_sla_work_schedules IS
  'Per-org business calendar for SLA due dates when policy uses business_hours (weekly_rules: dow 1=Mon..7=Sun, open/close HH:MM in org timezone).';

CREATE INDEX IF NOT EXISTS idx_org_sla_work_schedules_org ON public.organization_sla_work_schedules (organization_id);

-- ---------------------------------------------------------------------------
-- 2) Policies
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_sla_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  priority integer NOT NULL DEFAULT 100,
  first_response_sla_minutes integer NOT NULL CHECK (first_response_sla_minutes > 0),
  resolution_sla_minutes integer NOT NULL CHECK (resolution_sla_minutes > 0),
  inter_reply_sla_minutes integer NULL CHECK (inter_reply_sla_minutes IS NULL OR inter_reply_sla_minutes > 0),
  operational_hours_profile text NOT NULL DEFAULT '24x7'
    CHECK (operational_hours_profile IN ('24x7', 'business_hours')),
  work_schedule_id uuid NULL REFERENCES public.organization_sla_work_schedules (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT organization_sla_policies_name_len CHECK (char_length(name) <= 120),
  CONSTRAINT organization_sla_policies_desc_len CHECK (char_length(description) <= 500)
);

COMMENT ON TABLE public.organization_sla_policies IS
  'SLA policy rows; first matching active policy by ascending priority wins. inter_reply_sla_minutes reserved for future KPI.';

CREATE INDEX IF NOT EXISTS idx_org_sla_policies_org_status_priority
  ON public.organization_sla_policies (organization_id, status, priority, created_at);

-- ---------------------------------------------------------------------------
-- 3) Conditions (OR within one policy: match if no rows OR any row matches)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_sla_policy_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES public.organization_sla_policies (id) ON DELETE CASCADE,
  field text NOT NULL CHECK (field = 'channel'),
  operator text NOT NULL DEFAULT 'eq' CHECK (operator = 'eq'),
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_sla_policy_conditions_policy ON public.organization_sla_policy_conditions (policy_id);

-- ---------------------------------------------------------------------------
-- 4) RLS (mirror organization_omnichannel_sla)
-- ---------------------------------------------------------------------------
ALTER TABLE public.organization_sla_work_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_sla_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_sla_policy_conditions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "organization_sla_work_schedules_select" ON public.organization_sla_work_schedules;
CREATE POLICY "organization_sla_work_schedules_select"
  ON public.organization_sla_work_schedules FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "organization_sla_work_schedules_insert_owner_admin" ON public.organization_sla_work_schedules;
CREATE POLICY "organization_sla_work_schedules_insert_owner_admin"
  ON public.organization_sla_work_schedules FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND (
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
          AND ur.organization_id = organization_sla_work_schedules.organization_id
          AND ur.role IN ('owner', 'admin')
      )
      OR EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = organization_sla_work_schedules.organization_id
          AND (o.user_id = (SELECT auth.uid()) OR o.created_by = (SELECT auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS "organization_sla_work_schedules_update_owner_admin" ON public.organization_sla_work_schedules;
CREATE POLICY "organization_sla_work_schedules_update_owner_admin"
  ON public.organization_sla_work_schedules FOR UPDATE TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND (
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
          AND ur.organization_id = organization_sla_work_schedules.organization_id
          AND ur.role IN ('owner', 'admin')
      )
      OR EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = organization_sla_work_schedules.organization_id
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
          AND ur.organization_id = organization_sla_work_schedules.organization_id
          AND ur.role IN ('owner', 'admin')
      )
      OR EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = organization_sla_work_schedules.organization_id
          AND (o.user_id = (SELECT auth.uid()) OR o.created_by = (SELECT auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS "organization_sla_work_schedules_delete_owner_admin" ON public.organization_sla_work_schedules;
CREATE POLICY "organization_sla_work_schedules_delete_owner_admin"
  ON public.organization_sla_work_schedules FOR DELETE TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND (
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
          AND ur.organization_id = organization_sla_work_schedules.organization_id
          AND ur.role IN ('owner', 'admin')
      )
      OR EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = organization_sla_work_schedules.organization_id
          AND (o.user_id = (SELECT auth.uid()) OR o.created_by = (SELECT auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS "organization_sla_policies_select" ON public.organization_sla_policies;
CREATE POLICY "organization_sla_policies_select"
  ON public.organization_sla_policies FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.user_organization_ids()));

DROP POLICY IF EXISTS "organization_sla_policies_insert_owner_admin" ON public.organization_sla_policies;
CREATE POLICY "organization_sla_policies_insert_owner_admin"
  ON public.organization_sla_policies FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
    AND (
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
          AND ur.organization_id = organization_sla_policies.organization_id
          AND ur.role IN ('owner', 'admin')
      )
      OR EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = organization_sla_policies.organization_id
          AND (o.user_id = (SELECT auth.uid()) OR o.created_by = (SELECT auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS "organization_sla_policies_update_owner_admin" ON public.organization_sla_policies;
CREATE POLICY "organization_sla_policies_update_owner_admin"
  ON public.organization_sla_policies FOR UPDATE TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND (
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
          AND ur.organization_id = organization_sla_policies.organization_id
          AND ur.role IN ('owner', 'admin')
      )
      OR EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = organization_sla_policies.organization_id
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
          AND ur.organization_id = organization_sla_policies.organization_id
          AND ur.role IN ('owner', 'admin')
      )
      OR EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = organization_sla_policies.organization_id
          AND (o.user_id = (SELECT auth.uid()) OR o.created_by = (SELECT auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS "organization_sla_policies_delete_owner_admin" ON public.organization_sla_policies;
CREATE POLICY "organization_sla_policies_delete_owner_admin"
  ON public.organization_sla_policies FOR DELETE TO authenticated
  USING (
    organization_id IN (SELECT public.user_organization_ids())
    AND (
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
          AND ur.organization_id = organization_sla_policies.organization_id
          AND ur.role IN ('owner', 'admin')
      )
      OR EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = organization_sla_policies.organization_id
          AND (o.user_id = (SELECT auth.uid()) OR o.created_by = (SELECT auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS "organization_sla_policy_conditions_select" ON public.organization_sla_policy_conditions;
CREATE POLICY "organization_sla_policy_conditions_select"
  ON public.organization_sla_policy_conditions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_sla_policies p
      WHERE p.id = organization_sla_policy_conditions.policy_id
        AND p.organization_id IN (SELECT public.user_organization_ids())
    )
  );

DROP POLICY IF EXISTS "organization_sla_policy_conditions_insert" ON public.organization_sla_policy_conditions;
CREATE POLICY "organization_sla_policy_conditions_insert"
  ON public.organization_sla_policy_conditions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_sla_policies p
      WHERE p.id = organization_sla_policy_conditions.policy_id
        AND p.organization_id IN (SELECT public.user_organization_ids())
        AND (
          EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = (SELECT auth.uid())
              AND ur.organization_id = p.organization_id
              AND ur.role IN ('owner', 'admin')
          )
          OR EXISTS (
            SELECT 1 FROM public.organizations o
            WHERE o.id = p.organization_id
              AND (o.user_id = (SELECT auth.uid()) OR o.created_by = (SELECT auth.uid()))
          )
        )
    )
  );

DROP POLICY IF EXISTS "organization_sla_policy_conditions_update" ON public.organization_sla_policy_conditions;
CREATE POLICY "organization_sla_policy_conditions_update"
  ON public.organization_sla_policy_conditions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_sla_policies p
      WHERE p.id = organization_sla_policy_conditions.policy_id
        AND p.organization_id IN (SELECT public.user_organization_ids())
        AND (
          EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = (SELECT auth.uid())
              AND ur.organization_id = p.organization_id
              AND ur.role IN ('owner', 'admin')
          )
          OR EXISTS (
            SELECT 1 FROM public.organizations o
            WHERE o.id = p.organization_id
              AND (o.user_id = (SELECT auth.uid()) OR o.created_by = (SELECT auth.uid()))
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_sla_policies p
      WHERE p.id = organization_sla_policy_conditions.policy_id
        AND p.organization_id IN (SELECT public.user_organization_ids())
        AND (
          EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = (SELECT auth.uid())
              AND ur.organization_id = p.organization_id
              AND ur.role IN ('owner', 'admin')
          )
          OR EXISTS (
            SELECT 1 FROM public.organizations o
            WHERE o.id = p.organization_id
              AND (o.user_id = (SELECT auth.uid()) OR o.created_by = (SELECT auth.uid()))
          )
        )
    )
  );

DROP POLICY IF EXISTS "organization_sla_policy_conditions_delete" ON public.organization_sla_policy_conditions;
CREATE POLICY "organization_sla_policy_conditions_delete"
  ON public.organization_sla_policy_conditions FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_sla_policies p
      WHERE p.id = organization_sla_policy_conditions.policy_id
        AND p.organization_id IN (SELECT public.user_organization_ids())
        AND (
          EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = (SELECT auth.uid())
              AND ur.organization_id = p.organization_id
              AND ur.role IN ('owner', 'admin')
          )
          OR EXISTS (
            SELECT 1 FROM public.organizations o
            WHERE o.id = p.organization_id
              AND (o.user_id = (SELECT auth.uid()) OR o.created_by = (SELECT auth.uid()))
          )
        )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_sla_work_schedules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_sla_policies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_sla_policy_conditions TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) Backfill: schedule + default policy per org (from organization_omnichannel_sla)
-- ---------------------------------------------------------------------------
INSERT INTO public.organization_sla_work_schedules (organization_id, timezone, weekly_rules)
SELECT s.organization_id, 'Asia/Jakarta', '[
  {"dow":1,"open":"09:00","close":"17:00"},
  {"dow":2,"open":"09:00","close":"17:00"},
  {"dow":3,"open":"09:00","close":"17:00"},
  {"dow":4,"open":"09:00","close":"17:00"},
  {"dow":5,"open":"09:00","close":"17:00"}
]'::jsonb
FROM public.organization_omnichannel_sla s
ON CONFLICT (organization_id) DO NOTHING;

INSERT INTO public.organization_sla_policies (
  organization_id,
  name,
  description,
  status,
  priority,
  first_response_sla_minutes,
  resolution_sla_minutes,
  inter_reply_sla_minutes,
  operational_hours_profile,
  work_schedule_id
)
SELECT
  s.organization_id,
  'Default',
  'Migrated from legacy org SLA settings.',
  'active',
  10000,
  s.first_response_sla_minutes,
  s.resolution_sla_minutes,
  NULL,
  '24x7',
  ws.id
FROM public.organization_omnichannel_sla s
LEFT JOIN public.organization_sla_work_schedules ws ON ws.organization_id = s.organization_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.organization_sla_policies p
  WHERE p.organization_id = s.organization_id AND p.name = 'Default' AND p.priority = 10000
);

-- Orgs without legacy row: ensure schedule + default policy
INSERT INTO public.organization_sla_work_schedules (organization_id, timezone, weekly_rules)
SELECT o.id, 'Asia/Jakarta', '[
  {"dow":1,"open":"09:00","close":"17:00"},
  {"dow":2,"open":"09:00","close":"17:00"},
  {"dow":3,"open":"09:00","close":"17:00"},
  {"dow":4,"open":"09:00","close":"17:00"},
  {"dow":5,"open":"09:00","close":"17:00"}
]'::jsonb
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.organization_sla_work_schedules ws WHERE ws.organization_id = o.id
);

INSERT INTO public.organization_sla_policies (
  organization_id,
  name,
  description,
  status,
  priority,
  first_response_sla_minutes,
  resolution_sla_minutes,
  inter_reply_sla_minutes,
  operational_hours_profile,
  work_schedule_id
)
SELECT
  o.id,
  'Default',
  'Auto-created default SLA policy.',
  'active',
  10000,
  15,
  1440,
  NULL,
  '24x7',
  ws.id
FROM public.organizations o
JOIN public.organization_sla_work_schedules ws ON ws.organization_id = o.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.organization_sla_policies p WHERE p.organization_id = o.id
);
