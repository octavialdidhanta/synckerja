-- One-time backfill: copy CTWA click IDs from conversations to linked CRM leads.

UPDATE public.leads l
SET
  ctwa_clid = c.ctwa_clid,
  attribution = COALESCE(l.attribution, '{}'::jsonb) || jsonb_build_object(
    'ctwa_clid', c.ctwa_clid,
    'ctwa_captured_at', c.ctwa_captured_at
  ),
  updated_at = now()
FROM public.whatsapp_conversations c
WHERE l.organization_id = c.organization_id
  AND l.ticket_id = 'WA-' || upper(substr(replace(c.id::text, '-', ''), 1, 8))
  AND c.ctwa_clid IS NOT NULL
  AND l.ctwa_clid IS NULL;
