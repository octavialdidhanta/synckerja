# daily-task-comment-send-push

Send **summary** push notification (FCM) when Daily Task step comment notifications are enqueued.

## Trigger

Create a **Database Webhook** (recommended type: **Supabase Edge Functions**) on:

- Table: `public.task_step_comment_push_queue`
- Events: `INSERT`
- Edge function: `daily-task-comment-send-push`
- Deploy: `supabase functions deploy daily-task-comment-send-push --no-verify-jwt`
- Edge function setting: **Verify JWT = OFF**

> The DB trigger inserts **one queue row per recipient**; this function batches rows within a short window and sends **one summary** push.

## Secrets

Set in Supabase Dashboard → Edge Functions → `daily-task-comment-send-push` → Secrets:

- `FCM_SERVICE_ACCOUNT_JSON` (required)
- `FCM_PROJECT_ID` (optional; otherwise taken from service account JSON)
- `PUBLIC_APP_ORIGIN` (optional; used for notification image, defaults to `https://app.profitloop.id`)

## Payload

FCM `data` includes:

- `notificationType = daily_task_step_comment`
- `url = /tools/daily-task?task_id=...&task_step_id=...&open_step_comment=1`
- `badge` (optional string count)
