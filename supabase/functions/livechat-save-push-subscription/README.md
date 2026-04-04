# livechat-save-push-subscription

Edge Function called by the frontend when the user enables Live Chat notifications. Stores the Web Push subscription (endpoint + keys) in `push_subscriptions` for the authenticated user.

- **Method:** POST
- **Auth:** Required (Bearer JWT). User can only insert/update their own subscriptions (RLS).
- **Body:** `{ "endpoint": "...", "keys": { "p256dh": "...", "auth": "..." } }` (from `pushManager.subscribe()`).

## Deploy

```bash
supabase functions deploy livechat-save-push-subscription
```

JWT verification is enabled (default) so only logged-in users can save subscriptions.
