# livechat-save-fcm-token

Edge Function called by the native app (Capacitor Android/iOS) when the user enables or refreshes FCM push notifications. Stores the FCM device token in `fcm_tokens` for the authenticated user so `livechat-send-push` can send notifications when the app is in background.

## Request

- **Method:** POST
- **Headers:** `Authorization: Bearer <user JWT>`, `Content-Type: application/json`
- **Body:** `{ "token": "<FCM token string>", "platform": "android" | "ios" }`

## Deploy

```bash
supabase functions deploy livechat-save-fcm-token
```

JWT verification is required (default); the user must be logged in.
