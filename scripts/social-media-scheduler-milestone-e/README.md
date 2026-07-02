# Milestone E — Go-live checklist

Apply migration via SQL Editor (not `supabase db push` if drift):

- `supabase/migrations/20260628120000_social_media_scheduler_milestone_e.sql`

Deploy edge functions:

```bash
npm run supabase:functions:deploy:social-media-scheduler
npm run supabase:functions:deploy:youtube-content-all
npx supabase functions deploy meta-content-publish linkedin-content-publish --no-verify-jwt
```

Ensure `SCHEDULER_PUBLISH_DRY_RUN` is **off** (or unset) in Edge secrets.

## Per platform (pilot org)

### YouTube

1. Reconnect YouTube in settings (grant `youtube.upload`).
2. Confirm `upload_scopes_granted: true` on channel in settings API.
3. **Post Now** one Reel plan → video appears on channel (private default OK).
4. Schedule one post → cron publishes within 15 minutes.
5. Optional: interrupt mid-upload → row resumes via `claim_resume_publishing_posts`.

### Instagram Reels

1. Reconnect Meta Instagram (grant `instagram_content_publish` — requires Meta App Review).
2. **Post Now** one Reel → appears on IG account.
3. Schedule + cron smoke test.

### Facebook Reels

1. Reconnect Facebook Page in settings (grant `pages_manage_posts` — requires Meta App Review).
2. **Post Now** one Reel → appears on Facebook Page Reels tab.
3. Schedule + cron smoke test.
4. Delete published smoke test.

### LinkedIn

1. Reconnect LinkedIn (grant `w_organization_social` — requires Community Management API).
2. **Post Now** one Reel video → post on company page.
3. Schedule + cron smoke test.

## Monitoring

```sql
SELECT public.get_social_media_schedule_monitoring_summary();

SELECT platform, status, count(*)
FROM social_media_scheduled_posts
WHERE created_at > now() - interval '24 hours'
GROUP BY 1, 2
ORDER BY 1, 2;
```

## Rate limit smoke (optional)

Schedule 4+ posts same org same platform within 5 minutes → expect `rate_limited:org` badge, no `retry_count` burn.

## Rollback

Flip `scheduleReady: false` in `src/6-1-scheduled-posts/types/platform-delivery.ts` for affected platform and redeploy frontend only.
