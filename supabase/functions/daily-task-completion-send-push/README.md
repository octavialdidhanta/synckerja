# daily-task-completion-send-push

Send **summary** push notifications (FCM) when Daily Task completion events are enqueued.

## Trigger

Create a **Database Webhook** (recommended type: **Supabase Edge Functions**) on:

- Table: `public.daily_task_completion_push_queue`
- Events: `INSERT`
- Edge function: `daily-task-completion-send-push`
- Deploy: `supabase functions deploy daily-task-completion-send-push --no-verify-jwt`
- Edge function setting: **Verify JWT = OFF**

## Secrets

Set in Supabase Dashboard → Edge Functions → `daily-task-completion-send-push` → Secrets:

- `FCM_SERVICE_ACCOUNT_JSON` (required)
- `FCM_PROJECT_ID` (optional)
- `PUBLIC_APP_ORIGIN` (optional; for image)

## Payload

FCM `data` includes:

- `notificationType = daily_task_completion`
- `url = /tools/daily-task?view=jobdesc`
- `badge = <claimedCount>`

