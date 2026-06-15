# xendit-webhook (deprecated)

Webhook handling is **merged into `xendit-api`** to stay within Supabase edge function quota.

1. Update Xendit webhook URL to:
   ```
   https://<project-ref>.supabase.co/functions/v1/xendit-api
   ```
2. Delete this function from Supabase Dashboard → Functions → `xendit-webhook`
3. Redeploy `xendit-api` only

See `supabase/functions/xendit-api/README.md`.
