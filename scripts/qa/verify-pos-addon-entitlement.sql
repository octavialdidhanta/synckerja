-- QA: POS add-on entitlement (pos_addon_active) vs outlet extras.
-- Replace :org_id before running.

-- 1) Column + backfill expectation
SELECT
  organization_id,
  pos_addon_active,
  pos_paid_outlet_count,
  CASE
    WHEN pos_paid_outlet_count > 0 AND pos_addon_active = false THEN 'FAIL: paid extras without addon flag'
    ELSE 'ok'
  END AS check_backfill
FROM public.organization_subscriptions
WHERE organization_id = :org_id;

-- 2) Status RPC includes flag
SELECT public.get_subscription_status(:org_id) ->> 'pos_addon_active' AS pos_addon_active;

-- 3) Zero-charge enable (optional — run as org member)
-- SELECT public.enable_pos_addon_zero_charge(:org_id, 0);
