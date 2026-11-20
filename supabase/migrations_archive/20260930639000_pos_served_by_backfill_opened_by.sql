-- Served By backfill phase 2: fallback to session opened_by when waiter_id is null

UPDATE public.sales_activities sa
SET served_by_user_id = pts.opened_by
FROM public.pos_table_sessions pts
WHERE pts.sales_activity_id = sa.id
  AND sa.served_by_user_id IS NULL
  AND pts.waiter_id IS NULL
  AND pts.opened_by IS NOT NULL;

COMMENT ON COLUMN public.sales_activities.served_by_user_id IS
  'Waiter / order taker who served the bill (pos_table_sessions.waiter_id, else opened_by at pay). Distinct from created_by (Collected By).';
