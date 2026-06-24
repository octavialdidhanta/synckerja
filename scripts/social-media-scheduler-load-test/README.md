# Social Media Scheduler — Load Test (Milestone D)

Dry-run peak simulation: **50 org × 5 posts = 250 due** at `scheduled_at = now()` (simulates 18:00 WIB burst without waiting for clock).

## Prerequisites

1. Migration `20260627120000_social_media_scheduler_milestone_d.sql` applied.
2. Edge functions deployed (`social-media-scheduler`).
3. **Enable dry-run** on hosted project (Dashboard → Edge Functions → `social-media-scheduler` → Secrets):
   - `SCHEDULER_PUBLISH_DRY_RUN` = `true`
   - Optional: `SCHEDULER_DRY_RUN_LATENCY_MS` = `3000`
4. At least **50 organizations** in `public.organizations` (seed uses first 50 by `created_at`).
5. Cron secret matches `SCHEDULED_POSTS_INTERNAL_SECRET`.

## Production defaults (after Milestone D)

Singleton row `social_media_scheduler_config` (id = 1):

| Column | Default | Notes |
|--------|---------|-------|
| `batch_size` | 20 | Max fair-claim cap per inner loop |
| `per_org_per_tick` | 3 | Fairness across tenants |
| `tick_concurrency` | 4 | Parallel publish workers per tick |
| `tick_time_budget_ms` | 25000 | Stay under pg_cron HTTP timeout (45s) |
| `tiktok_global_in_flight` | 12 | Real TikTok only (skipped in dry-run) |

Env overrides (optional, no redeploy for quick experiments): `SCHEDULER_BATCH_SIZE`, `SCHEDULER_TICK_CONCURRENCY`, `SCHEDULER_TICK_TIME_BUDGET_MS`, etc.

## SLO (acceptance)

| Metric | Target |
|--------|--------|
| `pending_late_count` | 0 within **15 minutes** of seed |
| `pending_due_now_count` | 0 within **15 minutes** |
| p95 `published_at - scheduled_at` | ≤ **10 minutes** (dry-run) |
| `stuck_publishing_count` | 0 after run + 5 min |

## Procedure

### 1. Preflight

```sql
-- scripts/social-media-scheduler-load-test/preflight.sql
```

### 2. Seed 250 rows

```sql
-- scripts/social-media-scheduler-load-test/seed.sql
```

Expect `load_test_pending_due ≈ 250`.

### 3. Run scheduler loop

PowerShell:

```powershell
$env:SUPABASE_URL = "https://wqdzqqshoifwyrltzgvx.supabase.co"
$env:SCHEDULED_POSTS_INTERNAL_SECRET = "<your-secret>"
node scripts/social-media-scheduler-load-test/run.mjs --duration-minutes 20 --invoke-interval-sec 60
```

Or manual invoke every minute:

```powershell
Invoke-RestMethod -Method POST `
  -Uri "$env:SUPABASE_URL/functions/v1/social-media-scheduler" `
  -Headers @{ Authorization = "Bearer $env:SCHEDULED_POSTS_INTERNAL_SECRET" } `
  -ContentType "application/json" -Body "{}"
```

### 4. Report

```sql
-- scripts/social-media-scheduler-load-test/report.sql
```

### 5. Tuning (if SLO missed)

```sql
UPDATE public.social_media_scheduler_config
SET
  batch_size = 25,
  tick_concurrency = 6,
  tick_time_budget_ms = 28000,
  updated_at = now()
WHERE id = 1;
```

Re-run: `cleanup.sql` → `seed.sql` → `run.mjs` → `report.sql`.

**Load-test tip:** dry-run skips org rate-limit slots; for real peak defer testing, turn off dry-run (not recommended at 250 scale).

### 6. Teardown (required)

1. Set `SCHEDULER_PUBLISH_DRY_RUN` = `false` (or remove secret).
2. Run `cleanup.sql`.
3. Smoke test one real **Post Now** TikTok reel.

## Tuning playbook

| Symptom | Knob | Direction |
|---------|------|-----------|
| `pending_late` high, `duration_ms` < budget | `batch_size`, `tick_concurrency` | Increase |
| `deferred_rate_limited` high (real TikTok) | `max_publishes_per_5min`, `tiktok_global_in_flight` | Increase |
| `stuck_publishing` | `tick_concurrency`, `batch_size` | Decrease |
| pg_cron HTTP timeout | `tick_time_budget_ms` | Decrease (keep < 40s) |

## Throughput estimate (dry-run)

With defaults: ~4 concurrent × ~3s latency ≈ **12–15 publishes/tick** in 25s budget.

- 250 posts ÷ 13 ≈ **19 ticks** ≈ **19 minutes** at 1 invoke/minute.
- To hit **15 min SLO**: try `tick_concurrency = 6`, `batch_size = 25` (validate with report.sql).

## Files

| File | Purpose |
|------|---------|
| `seed.sql` | 50×5 load-test schedules |
| `preflight.sql` | Cron + config + due count |
| `run.mjs` | Automated invoke loop |
| `report.sql` | p95 latency + tick stats |
| `cleanup.sql` | Remove all `[LOAD_TEST]` data |
