-- Orgs with livechat but no workflow status after Open/Unread need "In Progress" for first-reply automation.

INSERT INTO public.lead_statuses (id, name, description, color, is_active, sort_order, organization_id, created_at, updated_at)
SELECT
  gen_random_uuid(),
  'In Progress',
  'Agent has replied; conversation is active',
  '#F59E0B',
  TRUE,
  2,
  o.id,
  NOW(),
  NOW()
FROM public.organizations o
WHERE (
  EXISTS (SELECT 1 FROM public.whatsapp_conversations w WHERE w.organization_id = o.id)
  OR EXISTS (SELECT 1 FROM public.email_conversations e WHERE e.organization_id = o.id)
  OR EXISTS (SELECT 1 FROM public.instagram_conversations i WHERE i.organization_id = o.id)
)
AND NOT EXISTS (
  SELECT 1
  FROM public.lead_statuses ls
  WHERE ls.organization_id = o.id
    AND LOWER(TRIM(ls.name)) IN ('in progress', 'on going', 'ongoing', 'in-progress')
);

-- Orgs that renamed Open → Unread but never added a post-reply workflow status.
INSERT INTO public.lead_statuses (id, name, description, color, is_active, sort_order, organization_id, created_at, updated_at)
SELECT
  gen_random_uuid(),
  'In Progress',
  'Agent has replied; conversation is active',
  '#F59E0B',
  TRUE,
  COALESCE((
    SELECT MAX(ls.sort_order) + 1
    FROM public.lead_statuses ls
    WHERE ls.organization_id = o.id
      AND LOWER(TRIM(ls.name)) IN ('unread', 'open')
  ), 2),
  o.id,
  NOW(),
  NOW()
FROM public.organizations o
WHERE EXISTS (
  SELECT 1 FROM public.instagram_conversations i WHERE i.organization_id = o.id
  UNION
  SELECT 1 FROM public.whatsapp_conversations w WHERE w.organization_id = o.id
  UNION
  SELECT 1 FROM public.email_conversations e WHERE e.organization_id = o.id
)
AND EXISTS (
  SELECT 1 FROM public.lead_statuses ls
  WHERE ls.organization_id = o.id
    AND LOWER(TRIM(ls.name)) IN ('unread', 'open')
)
AND NOT EXISTS (
  SELECT 1
  FROM public.lead_statuses ls
  WHERE ls.organization_id = o.id
    AND LOWER(TRIM(ls.name)) IN ('in progress', 'on going', 'ongoing', 'in-progress')
);
