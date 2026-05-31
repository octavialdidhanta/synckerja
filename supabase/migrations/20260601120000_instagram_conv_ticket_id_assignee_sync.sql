-- Align instagram_conversations.ticket_id with conversation id (IG-xxxxxxxx).
-- Leads Management syncs assignee via ticket_id; webhook previously used a random ticket_id.

UPDATE public.instagram_conversations ic
SET
  ticket_id = 'IG-' || UPPER(SUBSTRING(REPLACE(ic.id::text, '-', ''), 1, 8)),
  updated_at = NOW()
WHERE ic.ticket_id IS DISTINCT FROM 'IG-' || UPPER(SUBSTRING(REPLACE(ic.id::text, '-', ''), 1, 8));

-- Backfill conversation assignee from leads when user already assigned in Leads Management.
UPDATE public.instagram_conversations ic
SET
  assignee_id = l.assignee_id,
  updated_at = NOW()
FROM public.leads l
WHERE l.organization_id = ic.organization_id
  AND l.assignee_id IS NOT NULL
  AND (ic.assignee_id IS NULL OR TRIM(ic.assignee_id::text) = '')
  AND l.ticket_id IS NOT NULL
  AND TRIM(l.ticket_id) <> ''
  AND UPPER(TRIM(l.ticket_id)) = UPPER(TRIM(ic.ticket_id));
