# Meta Content Publish — App Review & Go-live Runbook

Instagram Reels and Facebook Page Reels auto-publish require Meta App Review for production users.

## Required permissions

| Platform | Permission | OAuth flow |
|----------|------------|------------|
| Instagram Reels | `instagram_content_publish` | Business Login (`VITE_META_OAUTH_CONFIG_ID`) — `/digital-marketing/social-media-performance/instagram/settings` |
| Facebook Reels | `pages_manage_posts` | Facebook Page OAuth (`VITE_META_FACEBOOK_OAUTH_CONFIG_ID`) — `/digital-marketing/social-media-performance/facebook/settings` |

Supporting permissions (usually already granted): `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`, `business_management`.

## Meta Developer Dashboard checklist

1. **Business Login config** (`VITE_META_OAUTH_CONFIG_ID`): include `instagram_content_publish` for Reels publishing.
2. **Facebook Page Login config** (`VITE_META_FACEBOOK_OAUTH_CONFIG_ID`): add `pages_manage_posts`.
3. **App Review** — submit both permissions with use case:
   > Schedule and publish Reels video from an internal content calendar to connected Instagram Business accounts and Facebook Pages. Video source is Google Drive; posts are scheduled in WIB timezone.
4. Provide: screencast of Publish Setup modal (Post Now + Schedule), privacy policy URL, test user credentials.
5. Add pilot org admins as **App testers** (or keep app in Development) until review is approved.

## Deploy edge functions

```bash
npm run supabase:functions:deploy:social-media-scheduler
npx supabase functions deploy meta-content-publish meta-oauth-exchange meta-content-config --no-verify-jwt
```

Ensure `SCHEDULER_PUBLISH_DRY_RUN` is **off** (or unset) in Edge secrets.

Apply migration (if not yet applied):

- `supabase/migrations/20260702120000_facebook_reels_auto_publish.sql`

## Per platform (pilot org)

### Instagram Reels

1. Open `/digital-marketing/social-media-performance/instagram/settings`.
2. Reconnect Meta account — confirm **Reels Publishing** permission card is green (`instagram_content_publish`).
3. Assign Instagram account on service required platforms (social media settings).
4. Open a Reel plan with: post date, approved, prod approved, Google Drive video link.
5. **Post Now** → Reel appears on IG; progress shows Published.
6. **Schedule** → cron publishes within ~15 minutes.
7. **Delete published** → post removed from IG + link cleared.

### Facebook Reels

1. Open `/digital-marketing/social-media-performance/facebook/settings`.
2. Reconnect Facebook Page — confirm **Facebook Reels Publishing** card is green (`pages_manage_posts`).
3. Assign Facebook Page on service required platforms.
4. Same Reel plan gates as Instagram.
5. **Post Now** → Reel on Facebook Page.
6. Schedule + cron smoke test.
7. Delete published smoke test.

## Sandbox vs production

| Mode | Who can publish |
|------|-----------------|
| Development + test users | App testers and roles added in Meta dashboard |
| Live (App Review approved) | Any user who grants permissions |

If publish returns `publish_scopes_not_granted` or OAuth error `#200`, reconnect the account after App Review approval.

## Monitoring

```sql
SELECT public.get_social_media_schedule_monitoring_summary();

SELECT platform, status, count(*)
FROM social_media_scheduled_posts
WHERE created_at > now() - interval '24 hours'
GROUP BY 1, 2
ORDER BY 1, 2;
```

## Rate limits

- Facebook Reels API: **30 published Reels per Page per 24 hours** (Meta enforced).
- Org scheduler: 3 posts / 5 min per org per platform (existing).

## Rollback

Flip `scheduleReady: false` for the affected platform in `src/6-1-scheduled-posts/types/platform-delivery.ts` and redeploy frontend only.
