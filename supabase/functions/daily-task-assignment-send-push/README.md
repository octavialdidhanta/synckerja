# daily-task-assignment-send-push

Send **summary** push notification (FCM) when Daily Task assignment notifications are enqueued.

## Trigger

Create a **Database Webhook** (recommended type: **Supabase Edge Functions**) on:

- Table: `public.daily_task_assignment_push_queue`
- Events: `INSERT`
- Edge function: `daily-task-assignment-send-push`
- Deploy: `supabase functions deploy daily-task-assignment-send-push --no-verify-jwt`
- Edge function setting: **Verify JWT = OFF**

> The DB trigger inserts **one queue row per recipient**; this function batches rows within a short window and sends **one summary** push.

## Secrets

Set in Supabase Dashboard → Edge Functions → `daily-task-assignment-send-push` → Secrets:

- `FCM_SERVICE_ACCOUNT_JSON` (required)
- `FCM_PROJECT_ID` (optional; otherwise taken from service account JSON)
- `PUBLIC_APP_ORIGIN` (optional; used for notification image, defaults to `https://app.profitloop.id`)

## Payload

FCM `data` includes:

- `notificationType = daily_task_assignment`
- `url = /tools/daily-task?...` (deep link to latest claimed event)
- `badge` (optional string count)

