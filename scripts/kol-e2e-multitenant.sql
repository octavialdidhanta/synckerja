-- KOL Multi-Tenant E2E regression checks for [MT-TEST] data
-- Org Synckerja: 663c9336-8cb6-4a36-9ad9-313126e70a1a
-- Org PT Indonesia: 0c4ce1c6-c501-4fb1-87de-1f4d0cc669b2

-- === Cleanup helper (run manually when resetting test data) ===
-- DELETE FROM kol_campaign_budget_allocations WHERE organization_id IN (...);
-- ... (respect FK order: budget_allocations → thresholds/metrics/conversions → milestones → payment_terms → posts → deliverables → assignments → campaigns → profiles)

-- === Phase 1: Budget accumulation (Diana 2-post) ===
SELECT
  'diana_budget' AS check_name,
  kba.allocated_budget,
  CASE WHEN kba.allocated_budget >= 11000000 THEN 'PASS' ELSE 'FAIL' END AS result
FROM kol_campaign_budget_allocations kba
JOIN kol_profiles kp ON kp.id = kba.kol_profile_id
JOIN kol_campaigns kc ON kc.id = kba.campaign_id
WHERE kp.name ILIKE '%[MT-TEST]%Diana%'
  AND kc.name ILIKE '%[MT-TEST]%Summer%';

-- === Phase 1: Summer campaign rollup ===
SELECT
  'summer_allocated' AS check_name,
  kc.allocated_budget,
  CASE WHEN kc.allocated_budget >= 21500000 THEN 'PASS' ELSE 'FAIL' END AS result
FROM kol_campaigns kc
WHERE kc.name ILIKE '%[MT-TEST]%Summer%';

-- === Phase 1: Raka actual_payout ===
SELECT
  'raka_actual_payout' AS check_name,
  kba.actual_payout,
  CASE WHEN kba.actual_payout >= 8000000 THEN 'PASS' ELSE 'FAIL' END AS result
FROM kol_campaign_budget_allocations kba
JOIN kol_profiles kp ON kp.id = kba.kol_profile_id
WHERE kp.name ILIKE '%[MT-TEST]%Raka%';

-- === Phase 1: Sarah milestone ↔ agreement sync ===
SELECT
  'sarah_milestone_sync' AS check_name,
  kpt.status,
  kpt.down_payment_amount,
  pm.status AS dp_milestone_status,
  CASE
    WHEN kpt.status IN ('partial_paid', 'dp_paid') AND pm.status = 'paid' THEN 'PASS'
    ELSE 'CHECK'
  END AS result
FROM kol_payment_terms kpt
JOIN kol_profiles kp ON kp.id = kpt.kol_profile_id
LEFT JOIN payment_milestones pm ON pm.payment_terms_id = kpt.id AND pm.milestone_order = 1
WHERE kp.name ILIKE '%[MT-TEST]%Sarah%'
  AND kpt.type = 'agreement';

-- === Phase 1: Tenant isolation ===
SELECT
  'tenant_isolation_synckerja' AS check_name,
  COUNT(DISTINCT kp.id) AS kol_count,
  CASE WHEN COUNT(DISTINCT kp.id) >= 5 THEN 'PASS' ELSE 'FAIL' END AS result
FROM kol_profiles kp
WHERE kp.organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'
  AND kp.name ILIKE '%[MT-TEST]%';

SELECT
  'tenant_isolation_pt_indonesia' AS check_name,
  COUNT(DISTINCT kp.id) AS kol_count,
  CASE WHEN COUNT(DISTINCT kp.id) >= 1 THEN 'PASS' ELSE 'FAIL' END AS result
FROM kol_profiles kp
WHERE kp.organization_id = '0c4ce1c6-c501-4fb1-87de-1f4d0cc669b2'
  AND kp.name ILIKE '%[MT-TEST]%';

-- === Phase 2: Threshold rows on agreement ===
SELECT
  'threshold_rows' AS check_name,
  kpt.id,
  COUNT(kpt2.id) AS threshold_count,
  CASE WHEN COUNT(kpt2.id) >= 1 THEN 'PASS' ELSE 'FAIL' END AS result
FROM kol_payment_terms kpt
JOIN kol_profiles kp ON kp.id = kpt.kol_profile_id
LEFT JOIN kol_performance_thresholds kpt2 ON kpt2.payment_terms_id = kpt.id
WHERE kp.name ILIKE '%[MT-TEST]%'
  AND kpt.type = 'agreement'
GROUP BY kpt.id;

-- === Phase 2: Auto bonus Sarah ===
SELECT
  'sarah_auto_bonus' AS check_name,
  kpt.bonus_amount,
  CASE WHEN kpt.bonus_amount >= 600000 THEN 'PASS' ELSE 'CHECK' END AS result
FROM kol_payment_terms kpt
JOIN kol_profiles kp ON kp.id = kpt.kol_profile_id
WHERE kp.name ILIKE '%[MT-TEST]%Sarah%'
  AND kpt.type = 'agreement';

-- === Phase 2: Marco engagement threshold ===
SELECT
  'marco_engagement_threshold' AS check_name,
  COUNT(kpt2.id) AS rows,
  CASE WHEN COUNT(kpt2.id) >= 1 THEN 'PASS' ELSE 'FAIL' END AS result
FROM kol_payment_terms kpt
JOIN kol_profiles kp ON kp.id = kpt.kol_profile_id
LEFT JOIN kol_performance_thresholds kpt2
  ON kpt2.payment_terms_id = kpt.id AND kpt2.metric_type = 'engagement'
WHERE kp.name ILIKE '%[MT-TEST]%Marco%'
  AND kpt.type = 'agreement';

-- =============================================================================
-- [MT-RETEST] regression checks (post findings fix)
-- =============================================================================

-- Campaign remaining_budget init
SELECT
  'retest_campaign_remaining' AS check_name,
  kc.name,
  kc.total_budget,
  kc.remaining_budget,
  CASE
    WHEN kc.remaining_budget = GREATEST(kc.total_budget - COALESCE(kc.allocated_budget, 0), 0) THEN 'PASS'
    ELSE 'FAIL'
  END AS result
FROM kol_campaigns kc
WHERE kc.name LIKE '[MT-RETEST]%';

-- No duplicate milestones
SELECT
  'retest_no_duplicate_milestones' AS check_name,
  COUNT(*) AS total_rows,
  COUNT(DISTINCT (payment_terms_id::text || '-' || milestone_order::text)) AS distinct_pairs,
  CASE
    WHEN COUNT(*) = COUNT(DISTINCT (payment_terms_id::text || '-' || milestone_order::text)) THEN 'PASS'
    ELSE 'FAIL'
  END AS result
FROM payment_milestones pm
JOIN kol_payment_terms kpt ON kpt.id = pm.payment_terms_id
JOIN kol_content_posts kcp ON kcp.id = kpt.kol_content_post_id
WHERE kcp.title LIKE '[MT-RETEST]%';

-- Evan 2-post budget accumulate
SELECT
  'retest_evan_budget' AS check_name,
  kba.allocated_budget,
  CASE WHEN kba.allocated_budget >= 12000000 THEN 'PASS' ELSE 'FAIL' END AS result
FROM kol_campaign_budget_allocations kba
JOIN kol_profiles kp ON kp.id = kba.kol_profile_id
WHERE kp.name = '[MT-RETEST] Evan Sports';

-- Fitri actual_payout
SELECT
  'retest_fitri_payout' AS check_name,
  kba.actual_payout,
  CASE WHEN kba.actual_payout >= 8500000 THEN 'PASS' ELSE 'FAIL' END AS result
FROM kol_campaign_budget_allocations kba
JOIN kol_profiles kp ON kp.id = kba.kol_profile_id
WHERE kp.name = '[MT-RETEST] Fitri Music';

-- Nina milestone ↔ agreement sync (after DP paid)
SELECT
  'retest_nina_milestone_sync' AS check_name,
  kpt.status,
  pm.status AS dp_status,
  kpt.down_payment_amount,
  CASE
    WHEN kpt.status IN ('partial_paid', 'dp_paid') AND pm.status = 'paid' THEN 'PASS'
    WHEN kpt.status = 'draft' AND pm.status = 'pending' THEN 'CHECK'
    ELSE 'FAIL'
  END AS result
FROM kol_payment_terms kpt
JOIN kol_content_posts kcp ON kcp.id = kpt.kol_content_post_id
LEFT JOIN payment_milestones pm ON pm.payment_terms_id = kpt.id AND pm.milestone_order = 1
WHERE kcp.title = '[MT-RETEST] Nina Vitamin Reels';

-- Nina auto bonus
SELECT
  'retest_nina_auto_bonus' AS check_name,
  kpt.bonus_amount,
  CASE WHEN kpt.bonus_amount >= 650000 THEN 'PASS' ELSE 'FAIL' END AS result
FROM kol_payment_terms kpt
JOIN kol_content_posts kcp ON kcp.id = kpt.kol_content_post_id
WHERE kcp.title = '[MT-RETEST] Nina Vitamin Reels';

-- Nina actual_payout (DP + bonus)
SELECT
  'retest_nina_actual_payout_full' AS check_name,
  kba.actual_payout,
  CASE WHEN kba.actual_payout >= 3900000 THEN 'PASS' ELSE 'FAIL' END AS result
FROM kol_campaign_budget_allocations kba
JOIN kol_profiles kp ON kp.id = kba.kol_profile_id
WHERE kp.name = '[MT-RETEST] Nina Wellness';

-- Budi engagement threshold + bonus
SELECT
  'retest_budi_engagement_bonus' AS check_name,
  kpt.bonus_amount,
  kth.is_achieved,
  CASE WHEN kpt.bonus_amount >= 400000 AND kth.is_achieved = true THEN 'PASS' ELSE 'FAIL' END AS result
FROM kol_payment_terms kpt
JOIN kol_profiles kp ON kp.id = kpt.kol_profile_id
LEFT JOIN kol_performance_thresholds kth ON kth.payment_terms_id = kpt.id AND kth.metric_type = 'engagement'
WHERE kp.name = '[MT-RETEST] Budi Travel';

-- Tenant isolation [MT-RETEST]
SELECT
  'retest_tenant_synckerja' AS check_name,
  COUNT(*) AS kol_count,
  CASE WHEN COUNT(*) = 5 THEN 'PASS' ELSE 'FAIL' END AS result
FROM kol_profiles
WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'
  AND name LIKE '[MT-RETEST]%';

SELECT
  'retest_tenant_pt_indonesia' AS check_name,
  COUNT(*) AS kol_count,
  CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS result
FROM kol_profiles
WHERE organization_id = '0c4ce1c6-c501-4fb1-87de-1f4d0cc669b2'
  AND name LIKE '[MT-RETEST]%';

-- =============================================================================
-- Production health: campaign targets + milestone duplicate monitor
-- =============================================================================

SELECT
  'all_campaigns_targets_filled' AS check_name,
  COUNT(*) FILTER (WHERE target_reach IS NULL OR target_reach <= 0) AS missing_reach,
  COUNT(*) FILTER (
    WHERE target_engagement IS NULL OR target_engagement <= 0 OR target_engagement > 100
  ) AS bad_engagement,
  COUNT(*) FILTER (WHERE target_conversion IS NULL OR target_conversion <= 0) AS missing_conversion,
  CASE
    WHEN COUNT(*) FILTER (
      WHERE target_reach IS NULL OR target_reach <= 0
        OR target_engagement IS NULL OR target_engagement <= 0 OR target_engagement > 100
        OR target_conversion IS NULL OR target_conversion <= 0
    ) = 0 THEN 'PASS'
    ELSE 'FAIL'
  END AS result
FROM kol_campaigns;

SELECT
  'milestone_duplicate_monitor' AS check_name,
  COUNT(*) AS duplicate_groups,
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS result
FROM audit_duplicate_payment_milestones();

SELECT
  'global_no_duplicate_milestones' AS check_name,
  CASE
    WHEN COUNT(*) = COUNT(DISTINCT (payment_terms_id::text || '-' || milestone_order::text))
    THEN 'PASS'
    ELSE 'FAIL'
  END AS result
FROM payment_milestones;
