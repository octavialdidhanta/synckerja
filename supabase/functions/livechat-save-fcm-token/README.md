# livechat-save-fcm-token

Edge Function called by the native app (Capacitor Android/iOS) when the user enables or refreshes FCM push notifications. Stores the FCM device token in `fcm_tokens` for the authenticated user so `livechat-send-push` can send notifications when the app is in background.

**Implementation note:** After `auth.getUser(jwt)` succeeds, the row is written with the **service role** client so RLS on `fcm_tokens` cannot block the upsert (the previous user-scoped upsert often returned HTTP 400).

**Database:** Apply migration `20260417103000_fcm_tokens_table.sql` (or ensure `fcm_tokens` exists with a **UNIQUE** index on `(user_id, token, context)`) so `upsert(..., onConflict: "user_id,token,context")` works.

## Request

- **Method:** POST
- **Headers:** `Authorization: Bearer <user JWT>`, `Content-Type: application/json`
- **Body:** `{ "token": "<FCM token string>", "platform": "android" | "ios" }`

## Deploy

```bash
supabase functions deploy livechat-save-fcm-token
```

JWT verification is required (default); the user must be logged in.
