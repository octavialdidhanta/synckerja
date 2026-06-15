# daily-task-assignment-send-push (deprecated)

Assignment FCM pushes are merged into **`daily-task-completion-send-push`** to avoid hitting the Supabase edge function limit.

## Use this instead

1. Deploy (or redeploy) only:

```bash
supabase functions deploy daily-task-completion-send-push --no-verify-jwt
```

2. Point the database webhook for `public.daily_task_assignment_push_queue` (INSERT) to **`daily-task-comment-send-push`**, not `daily-task-assignment-send-push`.

3. Do **not** deploy `daily-task-assignment-send-push` unless you have spare function slots.

See `supabase/functions/daily-task-completion-send-push/README.md` for webhook and secret setup.
