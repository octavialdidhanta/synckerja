# social-media-scheduler

Generic scheduled-post worker for all platforms. **Milestone A:** TikTok live; platform router + monitoring. **Milestone B:** atomic claim, retry backoff, stale recovery, TikTok `publish_id` resume. **Milestone C:** fair per-org claim, org/platform rate windows, internal defer without burning `retry_count`. **Milestone D:** tunable config, tick logs, parallel time-budget processing, dry-run load test harness.

## Deploy

```bash
npm run supabase:functions:deploy:social-media-scheduler
```

Deploys `social-media-scheduler`, `tiktok-content-scheduler` (shim), and `tiktok-content-publish`.

Apply migrations:

- `20260624120000_social_media_scheduler_milestone_a.sql` (cron 1 min, monitoring views)
- `20260625120000_social_media_scheduler_milestone_b.sql` (claim RPCs, `next_retry_at`, stale recovery)
- `20260626120000_social_media_scheduler_milestone_c.sql` (fair claim, rate windows, rate-limit monitoring)
- `20260627120000_social_media_scheduler_milestone_d.sql` (config singleton, tick logs, load-test cleanup, cron 45s timeout)

## Auth

`POST` with header:

```
Authorization: Bearer <SCHEDULED_POSTS_INTERNAL_SECRET>
```

Service role JWT is also accepted.

`verify_jwt = false` — auth is checked inside the function.

## pg_cron

Job name: `social-media-scheduler`  
Schedule: `*/1 * * * *` (every minute)  
SQL: `SELECT public.invoke_social_media_scheduler_edge();`

### Vault secrets (hosted)

| Secret | Purpose |
|--------|---------|
| `social_media_scheduler_project_url` | Supabase project URL (fallback: `tiktok_scheduler_project_url`) |
| `social_media_scheduler_cron_secret` | Bearer token (= `SCHEDULED_POSTS_INTERNAL_SECRET`) |

Legacy `tiktok_scheduler_*` secrets still work via fallback in the migration.

## Response

```json
{
  "processed": 12,
  "claimed": 12,
  "resumed": 0,
  "recovered_stale": 0,
  "deferred_rate_limited": 0,
  "published_ok": 12,
  "failed": 0,
  "batch_size": 20,
  "duration_ms": 24800,
  "dry_run": false,
  "config_snapshot": { "batch_size": 20, "tick_concurrency": 4, "tick_time_budget_ms": 25000 },
  "results": [{ "id": "...", "ok": true, "platform": "TikTok" }],
  "monitoring": {
    "pending_late_count": 0,
    "stuck_publishing_count": 0,
    "failed_24h_count": 0,
    "rate_deferred_count": 0,
    "pending_due_now_count": 0
  }
}
```

Counts are logged with `console.warn` when any value is > 0.

## Milestone B — lock & idempotency

Each scheduler tick:

1. `recover_stale_publishing_rows(20)` — reset incomplete uploads to `pending` + backoff
2. `claim_due_scheduled_posts(25)` — `FOR UPDATE SKIP LOCKED` on due `pending` rows
3. `claim_resume_publishing_posts(10)` — stale `publishing` rows with `tiktok_publish_id` (poll-only resume)
4. Run `runScheduledPostJob` per claimed row (no double-claim)

**Retry backoff** (`next_retry_at`): 2m → 5m → 15m → 30m → 60m (cap).

**TikTok resume:** `provider_config.tiktok_publish_id` + `tiktok_upload_completed` persisted mid-upload; resume path polls without re-upload.

## Milestone C — rate limit & fair scheduling

Each scheduler tick (after Milestone B steps 1–3):

4. **Rate limits** before `executeScheduledPost` per claimed row:
   - Global TikTok in-flight cap: **12** concurrent `publishing` rows
   - Org+platform window: **3** publish starts per **5 minutes** (`try_acquire_social_media_publish_slot`)
   - TikTok resume rows skip org window (poll-only); still respect global cap
5. On rate limit: revert to `pending`, set `next_retry_at` ~90s, `error_message` = `rate_limited:org` or `rate_limited:global` — **no** `retry_count` increment

**Fair claim:** `claim_due_scheduled_posts(25, 3)` — max **3** due rows per `organization_id` per tick (FIFO across orgs).

**TikTok HTTP 429:** `Retry-After` header parsed → `http 429 retry-after:N` → backoff via `computeNextRetryAtFrom429` (60s–15m).

Defaults in `organization_social_media_scheduling_settings.max_publishes_per_5min` (default 3).

### Verification checklist (Milestone C)

- [ ] One org with 10 due posts → at most 3 claimed per tick; others stay `pending`
- [ ] Org at 5-min cap → row deferred with `rate_limited:org`; `retry_count` unchanged
- [ ] 13+ TikTok `publishing` → defer `rate_limited:global`
- [ ] UI shows queue hint (not red error) for `rate_limited:*` on `pending`
- [ ] Milestone B regression: no double publish, stale resume, error backoff still works

```sql
SELECT organization_id, count(*) FROM social_media_scheduled_posts
WHERE status = 'publishing' GROUP BY 1;

SELECT count(*) FROM v_social_media_schedules_rate_deferred;
SELECT public.get_social_media_schedule_monitoring_summary();
```

## Milestone D — load test & tuning

### Runtime config (singleton)

```sql
SELECT * FROM public.social_media_scheduler_config WHERE id = 1;

UPDATE public.social_media_scheduler_config
SET batch_size = 25, tick_concurrency = 6, tick_time_budget_ms = 28000, updated_at = now()
WHERE id = 1;
```

| Column | Production default | Purpose |
|--------|-------------------|---------|
| `batch_size` | 20 | Fair-claim cap per inner loop |
| `per_org_per_tick` | 3 | Max due rows per org per tick |
| `tick_concurrency` | 4 | Parallel `runScheduledPostJob` workers |
| `tick_time_budget_ms` | 25000 | Max tick wall time (under pg_cron 45s HTTP timeout) |
| `tiktok_global_in_flight` | 12 | Global publishing cap (real TikTok) |

Env overrides (optional): `SCHEDULER_BATCH_SIZE`, `SCHEDULER_TICK_CONCURRENCY`, `SCHEDULER_TICK_TIME_BUDGET_MS`, `SCHEDULER_TIKTOK_GLOBAL_IN_FLIGHT`.

### Dry-run load test (250 due)

1. Set Edge secret `SCHEDULER_PUBLISH_DRY_RUN=true` (only rows with `load_test` marker or `load-test://` URL).
2. Follow [`scripts/social-media-scheduler-load-test/README.md`](../../../scripts/social-media-scheduler-load-test/README.md).
3. **Disable dry-run** and run `cleanup.sql` after test.

### Tick flow (Milestone D)

1. `loadSchedulerConfig` → recover stale → resume batch (parallel)
2. **Time-budget loop:** incremental fair claim (`min(batch_size, tick_concurrency)`) → `runWithConcurrency` until budget exhausted
3. Insert `social_media_scheduler_tick_logs` row per invoke

### Monitoring (SQL)

| View / table | Meaning |
|--------------|---------|
| `social_media_scheduler_tick_logs` | Per-invoke metrics |
| `v_social_media_scheduler_tick_stats_1h` | avg/p95 duration, throughput |
| `cleanup_social_media_load_test_rows()` | Remove `[LOAD_TEST]` seed data |

### Verification checklist (Milestone D)

- [ ] `duration_ms` ≤ `tick_time_budget_ms` on typical ticks
- [ ] Dry-run 250 due → `pending_due_now_count` → 0 within 15 min (after tuning)
- [ ] `social_media_scheduler_tick_logs` populated each invoke
- [ ] Real `post_now` works with `SCHEDULER_PUBLISH_DRY_RUN` off
- [ ] `cleanup_social_media_load_test_rows()` removes all seed data

### Verification checklist (Milestone B)

- [ ] Parallel scheduler invokes → no duplicate `published` for one schedule id
- [ ] Transient error → `pending` + `next_retry_at` in future; not claimed until due
- [ ] Stale `publishing` + `tiktok_publish_id` → resume poll, not full re-upload
- [ ] `post_now` and normal schedule still work

```sql
SELECT id, status, next_retry_at, retry_count, locked_at
FROM social_media_scheduled_posts
WHERE status IN ('pending', 'publishing')
ORDER BY updated_at DESC
LIMIT 20;
```

## Monitoring (SQL)

| View / RPC | Meaning |
|------------|---------|
| `v_social_media_schedules_pending_late` | `pending` and `scheduled_at` > 3 min ago |
| `v_social_media_schedules_stuck_publishing` | `publishing` and `updated_at` > 20 min ago |
| `v_social_media_schedules_failed_24h` | `failed` in last 24 hours |
| `v_social_media_schedules_rate_deferred` | `pending` deferred by internal rate limit |
| `get_social_media_schedule_monitoring_summary()` | JSON counts + samples (`rate_deferred_count`, `pending_due_now_count`) |

```sql
SELECT count(*) FROM v_social_media_schedules_pending_late;
SELECT count(*) FROM v_social_media_schedules_stuck_publishing;
SELECT count(*) FROM v_social_media_schedules_failed_24h;
SELECT count(*) FROM v_social_media_schedules_rate_deferred;
SELECT public.get_social_media_schedule_monitoring_summary();
```

## Manual test

```bash
curl -X POST "$SUPABASE_URL/functions/v1/social-media-scheduler" \
  -H "Authorization: Bearer $SCHEDULED_POSTS_INTERNAL_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Platform router

Shared code: `supabase/functions/_shared/scheduledPosts/`

- `platformRegistry.ts` — capability map
- `executeScheduledPost.ts` — dispatch
- `runScheduledPostJob.ts` — status transitions + retry + idempotency
- `handleSchedulerTick.ts` — recover → time-budget fair claim → parallel process → tick log
- `claim/` — `claimDueScheduledPosts`, `recoverStalePublishing`
- `config/` — `loadSchedulerConfig`, `schedulerConfigTypes`
- `process/` — `runWithConcurrency`
- `dryRun/` — `shouldDryRunPublish`
- `rateLimit/` — `acquirePublishSlot`, `deferForRateLimit`, `publishResume`, `countGlobalInFlight`, `globalInFlightCap`, `rateLimitConfig`

## Milestone E — platform executors (YouTube, Instagram, LinkedIn)

### Edge publish APIs

| Platform | Function | Executor |
|----------|----------|----------|
| TikTok | `tiktok-content-publish` | `executeTikTokScheduledPost` |
| YouTube | `youtube-content-publish` | `executeYouTubeScheduledPost` |
| Instagram | `meta-content-publish` | `executeInstagramScheduledPost` |
| LinkedIn | `linkedin-content-publish` | `executeLinkedInScheduledPost` |

Apply migration: `20260628120000_social_media_scheduler_milestone_e.sql`

Deploy:

```bash
npm run supabase:functions:deploy:social-media-scheduler
npm run supabase:functions:deploy:youtube-content-all
npx supabase functions deploy meta-content-publish linkedin-content-publish --no-verify-jwt
```

### OAuth scopes required

| Platform | Scope | Reconnect in settings |
|----------|-------|----------------------|
| YouTube | `youtube.upload` | YouTube Content settings |
| Instagram | `instagram_content_publish` | Meta / Instagram settings |
| LinkedIn | `w_organization_social` | LinkedIn Content settings |

### Global in-flight caps (config singleton)

| Column | Default |
|--------|---------|
| `youtube_global_in_flight` | 6 |
| `instagram_global_in_flight` | 4 |
| `linkedin_global_in_flight` | 4 |

Env: `SCHEDULER_YOUTUBE_GLOBAL_IN_FLIGHT`, `SCHEDULER_INSTAGRAM_GLOBAL_IN_FLIGHT`, `SCHEDULER_LINKEDIN_GLOBAL_IN_FLIGHT`.

### Go-live checklist

See [`scripts/social-media-scheduler-milestone-e/README.md`](../../../scripts/social-media-scheduler-milestone-e/README.md).
