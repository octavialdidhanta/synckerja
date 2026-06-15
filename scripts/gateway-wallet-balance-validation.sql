-- Gateway wallet balance validation (Brick + Xendit snapshots)
-- Run in Supabase SQL Editor after migration 20260615120000_organization_gateway_wallets.sql

-- 1. Snapshot rows per org
SELECT
  ogw.organization_id,
  o.company_name AS org_name,
  ogw.provider,
  ogw.usable_balance,
  ogw.pending_balance,
  ogw.total_balance,
  ogw.currency,
  ogw.synced_at,
  ogw.sync_error,
  ogw.updated_at
FROM public.organization_gateway_wallets ogw
JOIN public.organizations o ON o.id = ogw.organization_id
ORDER BY ogw.synced_at DESC NULLS LAST;

-- 2. Brick eligibility: orgs with linked bank accounts but no brick snapshot
SELECT
  ba.organization_id,
  o.company_name AS org_name,
  COUNT(*) FILTER (WHERE ba.brick_link_status = 'linked') AS linked_accounts
FROM public.bank_accounts ba
JOIN public.organizations o ON o.id = ba.organization_id
GROUP BY ba.organization_id, o.company_name
HAVING COUNT(*) FILTER (WHERE ba.brick_link_status = 'linked') > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.organization_gateway_wallets ogw
    WHERE ogw.organization_id = ba.organization_id
      AND ogw.provider = 'brick'
  );

-- 3. Xendit eligibility: enabled sub-accounts without snapshot
SELECT
  oxa.organization_id,
  o.company_name AS org_name,
  oxa.xendit_sub_account_id,
  oxa.is_enabled
FROM public.organization_xendit_accounts oxa
JOIN public.organizations o ON o.id = oxa.organization_id
WHERE oxa.is_enabled = true
  AND oxa.xendit_sub_account_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.organization_gateway_wallets ogw
    WHERE ogw.organization_id = oxa.organization_id
      AND ogw.provider = 'xendit'
  );

-- 4. Stale snapshots (> 15 minutes) or sync errors
SELECT
  organization_id,
  provider,
  usable_balance,
  synced_at,
  sync_error,
  EXTRACT(EPOCH FROM (now() - synced_at)) / 60 AS minutes_since_sync
FROM public.organization_gateway_wallets
WHERE sync_error IS NOT NULL
   OR synced_at IS NULL
   OR synced_at < now() - interval '15 minutes'
ORDER BY synced_at NULLS FIRST;

-- 5. Period net sanity (Brick VA in − disbursements out) — replace org id
-- SET org_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a';
WITH params AS (
  SELECT
    '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid AS org_id,
    date_trunc('month', now()) AS period_start,
    date_trunc('month', now()) + interval '1 month' AS period_end
)
SELECT
  'brick_va_in' AS line,
  COALESCE(SUM(bpr.expected_amount), 0) AS amount
FROM public.brick_payment_requests bpr, params p
WHERE bpr.organization_id = p.org_id
  AND bpr.status IN ('completed', 'paid')
  AND COALESCE(bpr.completed_at, bpr.paid_at) >= p.period_start
  AND COALESCE(bpr.completed_at, bpr.paid_at) < p.period_end
UNION ALL
SELECT
  'brick_disb_out',
  COALESCE(SUM(bd.amount), 0)
FROM public.brick_disbursements bd, params p
WHERE bd.organization_id = p.org_id
  AND bd.status = 'completed'
  AND bd.completed_at >= p.period_start
  AND bd.completed_at < p.period_end
UNION ALL
SELECT
  'xendit_va_in',
  COALESCE(SUM(xpr.expected_amount), 0) AS amount
FROM public.xendit_payment_requests xpr, params p
WHERE xpr.organization_id = p.org_id
  AND xpr.status = 'paid'
  AND xpr.paid_at >= p.period_start
  AND xpr.paid_at < p.period_end
UNION ALL
SELECT
  'xendit_disb_out',
  COALESCE(SUM(xd.amount), 0)
FROM public.xendit_disbursements xd, params p
WHERE xd.organization_id = p.org_id
  AND xd.status = 'completed'
  AND xd.completed_at >= p.period_start
  AND xd.completed_at < p.period_end;

-- 7. Xendit: compare snapshot vs raw API payload (sub-account CASH)
SELECT
  ogw.organization_id,
  o.company_name,
  oxa.xendit_sub_account_id,
  ogw.usable_balance AS snapshot_cash,
  ogw.pending_balance AS snapshot_holding,
  ogw.synced_at,
  ogw.raw_payload->'cash'->>'balance' AS api_cash_balance,
  ogw.raw_payload
FROM public.organization_gateway_wallets ogw
JOIN public.organization_xendit_accounts oxa
  ON oxa.organization_id = ogw.organization_id
JOIN public.organizations o ON o.id = ogw.organization_id
WHERE ogw.provider = 'xendit';

-- 8. Compare ERP bank total vs gateway (no double-count check)
-- bank_statement_balance is mutasi drift, NOT disbursement wallet
SELECT
  ba.organization_id,
  SUM(bab.balance) AS erp_bank_total,
  MAX(ogw_brick.usable_balance) AS brick_wallet,
  MAX(ogw_xendit.usable_balance) AS xendit_wallet
FROM public.bank_account_balances bab
JOIN public.bank_accounts ba ON ba.id = bab.bank_account_id
LEFT JOIN public.organization_gateway_wallets ogw_brick
  ON ogw_brick.organization_id = ba.organization_id AND ogw_brick.provider = 'brick'
LEFT JOIN public.organization_gateway_wallets ogw_xendit
  ON ogw_xendit.organization_id = ba.organization_id AND ogw_xendit.provider = 'xendit'
GROUP BY ba.organization_id;
