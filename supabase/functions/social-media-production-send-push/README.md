# social-media-production-send-push

Send FCM push notifications when social media production review events are enqueued (approve, request revision, revision submitted).

## Trigger

Create a **Database Webhook** (recommended type: **Supabase Edge Functions**) on:

- Table: `public.social_media_production_push_queue`
- Events: `INSERT`
- Edge function: `social-media-production-send-push`
- Deploy: `supabase functions deploy social-media-production-send-push --no-verify-jwt`
- Edge function setting: **Verify JWT = OFF**

## Secrets

Set in Supabase Dashboard → Edge Functions → `social-media-production-send-push` → Secrets:

- `FCM_SERVICE_ACCOUNT_JSON` (required)
- `FCM_PROJECT_ID` (optional)
- `PUBLIC_APP_ORIGIN` (optional; for notification image)

## Payload

FCM `data` includes:

- `notificationType = social_media_production_review`
- `url` — deep link (`/review/{token}`, `/tools/daily-task?view=jobdesc`, or dashboard)
- `review_token` (when available)
- `event_type` — `approved` | `revision_requested` | `revision_submitted`
- `social_media_plan_id`
- `badge` — claimed batch count

## Database

Apply migration `20260529120000_social_media_production_push_notifications.sql` before enabling the webhook.
