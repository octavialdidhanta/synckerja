-- Served By backfill phase 3: heuristic match for legacy checkouts without sales_activity_id link.
-- Match when checkout occurred during a table session (seated_at .. closed_at + 2 min grace).

WITH candidates AS (
  SELECT
    sa.id AS activity_id,
    COALESCE(pts.waiter_id, pts.opened_by) AS server_user_id,
    row_number() OVER (
      PARTITION BY sa.id
      ORDER BY pts.seated_at DESC
    ) AS rn
  FROM public.sales_activities sa
  JOIN public.pos_table_sessions pts
    ON pts.organization_id = sa.organization_id
   AND pts.outlet_id = sa.pos_outlet_id
   AND COALESCE(pts.waiter_id, pts.opened_by) IS NOT NULL
   AND pts.status IN ('paid', 'open', 'cancelled')
   AND sa.created_at >= pts.seated_at
   AND (pts.closed_at IS NULL OR sa.created_at <= pts.closed_at + interval '2 minutes')
   AND (
     (sa.pos_table_id IS NOT NULL AND pts.pos_table_id = sa.pos_table_id)
     OR (
       sa.pos_table_id IS NULL
       AND sa.table_number IS NOT NULL
       AND lower(btrim(pts.table_name)) = lower(btrim(sa.table_number))
     )
   )
  WHERE sa.activity_type = 'Store Checkout'
    AND sa.status = 'Converted'
    AND COALESCE(sa.refund_status, 'none') = 'none'
    AND sa.served_by_user_id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.pos_table_sessions linked
      WHERE linked.sales_activity_id = sa.id
    )
),
best AS (
  SELECT activity_id, server_user_id
  FROM candidates
  WHERE rn = 1
    AND server_user_id IS NOT NULL
)
UPDATE public.sales_activities sa
SET served_by_user_id = b.server_user_id
FROM best b
WHERE sa.id = b.activity_id
  AND sa.served_by_user_id IS NULL;
