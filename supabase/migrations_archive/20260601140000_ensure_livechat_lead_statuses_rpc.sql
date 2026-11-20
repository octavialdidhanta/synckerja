-- Full livechat status set per org (parity with WhatsApp): Unread/Open, In Progress, Converted, Qualified, Closed (+ keep Expired if present).

CREATE OR REPLACE FUNCTION public.ensure_livechat_lead_statuses_for_org(p_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_unread boolean;
  v_max_sort integer;
BEGIN
  IF p_organization_id IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.lead_statuses ls
    WHERE ls.organization_id = p_organization_id
      AND LOWER(TRIM(ls.name)) IN ('open', 'unread')
  ) INTO v_has_unread;

  IF NOT v_has_unread THEN
    INSERT INTO public.lead_statuses (
      id, name, description, color, is_active, sort_order, organization_id, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      'Open',
      'New inbound conversation',
      '#6B7280',
      TRUE,
      1,
      p_organization_id,
      NOW(),
      NOW()
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.lead_statuses ls
    WHERE ls.organization_id = p_organization_id
      AND LOWER(TRIM(ls.name)) IN ('in progress', 'on going', 'ongoing', 'in-progress')
  ) THEN
    INSERT INTO public.lead_statuses (
      id, name, description, color, is_active, sort_order, organization_id, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      'In Progress',
      'Agent has replied; conversation is active',
      '#F59E0B',
      TRUE,
      2,
      p_organization_id,
      NOW(),
      NOW()
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.lead_statuses ls
    WHERE ls.organization_id = p_organization_id
      AND LOWER(TRIM(ls.name)) = 'converted'
  ) THEN
    INSERT INTO public.lead_statuses (
      id, name, description, color, is_active, sort_order, organization_id, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      'Converted',
      'Lead converted to sale',
      '#10B981',
      TRUE,
      3,
      p_organization_id,
      NOW(),
      NOW()
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.lead_statuses ls
    WHERE ls.organization_id = p_organization_id
      AND LOWER(TRIM(ls.name)) = 'qualified'
  ) THEN
    INSERT INTO public.lead_statuses (
      id, name, description, color, is_active, sort_order, organization_id, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      'Qualified',
      'Qualified prospect',
      '#3B82F6',
      TRUE,
      4,
      p_organization_id,
      NOW(),
      NOW()
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.lead_statuses ls
    WHERE ls.organization_id = p_organization_id
      AND LOWER(TRIM(ls.name)) IN ('closed', 'resolve')
  ) THEN
    INSERT INTO public.lead_statuses (
      id, name, description, color, is_active, sort_order, organization_id, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      'Closed',
      'Conversation resolved (Resolve in UI)',
      '#6B7280',
      TRUE,
      5,
      p_organization_id,
      NOW(),
      NOW()
    );
  END IF;
END;
$$;

COMMENT ON FUNCTION public.ensure_livechat_lead_statuses_for_org(uuid) IS
  'Idempotent: ensure org has Open/Unread, In Progress, Converted, Qualified, Closed for livechat parity with WhatsApp.';

GRANT EXECUTE ON FUNCTION public.ensure_livechat_lead_statuses_for_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_livechat_lead_statuses_for_org(uuid) TO service_role;

-- Backfill all orgs with livechat channels
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT o.id AS organization_id
    FROM public.organizations o
    WHERE EXISTS (
      SELECT 1 FROM public.whatsapp_conversations w WHERE w.organization_id = o.id
      UNION
      SELECT 1 FROM public.email_conversations e WHERE e.organization_id = o.id
      UNION
      SELECT 1 FROM public.instagram_conversations i WHERE i.organization_id = o.id
    )
  LOOP
    PERFORM public.ensure_livechat_lead_statuses_for_org(r.organization_id);
  END LOOP;
END;
$$;
