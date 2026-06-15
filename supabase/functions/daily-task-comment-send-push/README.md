# daily-task-comment-send-push

Send **summary** push notification (FCM) for Daily Task **step comments** and **assignment** queue rows.

> Assignment pushes are merged here so you do not need a separate `daily-task-assignment-send-push` function on limited Supabase plans.

## Triggers

Create **Database Webhooks** (type: **Supabase Edge Functions**) on:

### Step comments

- Table: `public.task_step_comment_push_queue`
- Events: `INSERT`
- Edge function: `daily-task-comment-send-push`

### Assignment (assign / unassign)

- Table: `public.daily_task_assignment_push_queue`
- Events: `INSERT`
- Edge function: **`daily-task-comment-send-push`** (same function)

Deploy once:

```bash
supabase functions deploy daily-task-comment-send-push --no-verify-jwt
```

Edge function setting: **Verify JWT = OFF**

> The DB trigger inserts **one queue row per recipient**; this function batches rows within a short window and sends **one summary** push.

## Secrets

Set in Supabase Dashboard → Edge Functions → `daily-task-comment-send-push` → Secrets:

- `FCM_SERVICE_ACCOUNT_JSON` (required)
- `FCM_PROJECT_ID` (optional; otherwise taken from service account JSON)
- `PUBLIC_APP_ORIGIN` (optional; used for notification image, defaults to `https://app.profitloop.id`)

## FCM payload

**Comments**

- `notificationType = daily_task_step_comment`
- `url = /tools/daily-task?task_id=...&task_step_id=...&open_step_comment=1`
- `badge` (optional string count)

**Assignment**

- `notificationType = daily_task_assignment`
- `eventType = assign | unassign | reassign`
- `url = /tools/daily-task?...`
- `badge` (optional string count)

Assignment body examples:

- assign: `Ditugaskan: {title}`
- unassign: `Penugasan dicabut: {title}`
