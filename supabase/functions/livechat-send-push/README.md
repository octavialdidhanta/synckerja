# livechat-send-push

Edge Function invoked by **Database Webhooks** when a new message is inserted into `whatsapp_messages`, `instagram_messages`, or `email_messages`. Sends **Web Push** notifications to browser subscribers and **FCM** notifications to native app (Android/iOS) devices. Notification title format: `[WhatsApp] Sender name` (or Instagram/Email).

## Deploy

```bash
supabase functions deploy livechat-send-push --no-verify-jwt
```

`--no-verify-jwt` is required so the Database Webhook (which uses the service role header) can invoke the function.

## Secrets

Set in Supabase Dashboard → Edge Functions → livechat-send-push → Secrets (or via CLI):

| Secret | Description |
|--------|-------------|
| `VAPID_KEYS` | JSON string from `exportVapidKeys()` (JWK format). Required for Web Push. Generate with: `deno run https://raw.githubusercontent.com/negrel/webpush/master/cmd/generate-vapid-keys.ts` — use the printed JSON (both keys). |
| `FCM_SERVICE_ACCOUNT_JSON` | (Optional) Full JSON string of the Firebase service account key (from Firebase Console → Project Settings → Service accounts → Generate new private key). Required for FCM (native Android/iOS). |
| `FCM_PROJECT_ID` | (Optional) Firebase project ID. If unset, read from `project_id` inside `FCM_SERVICE_ACCOUNT_JSON`. |
| `LIVECHAT_APP_ORIGIN` | (Optional) Base URL for deep links, e.g. `https://app.profitloop.id`. If unset, defaults to `https://app.profitloop.id`. |
| `VAPID_CONTACT_EMAIL` | (Optional) Mailto for VAPID, e.g. `mailto:support@example.com`. |

## Database Webhooks

In Supabase Dashboard → Database → Webhooks, create **3 webhooks**:

1. **Table:** `public.whatsapp_messages`, **Events:** Insert → **URL:** Supabase Edge Function `livechat-send-push`, Method POST, add auth header with service key.
2. **Table:** `public.instagram_messages`, **Events:** Insert → same.
3. **Table:** `public.email_messages`, **Events:** Insert → same.

Timeout: 30 seconds recommended.

## Frontend

- Public key from the same VAPID pair must be set as `VITE_VAPID_PUBLIC_KEY` (base64url string). The generate script also prints "your application server key" — use that for the frontend env.

## Troubleshooting: Push not showing on Android (WhatsApp inbound, etc.)

If inbound WhatsApp (or Instagram/email) messages do **not** show a push notification on the native Android app:

1. **Database Webhook** — Supabase Dashboard → **Database** → **Webhooks**. Ensure a webhook exists for **Table:** `public.whatsapp_messages` (and optionally `instagram_messages`, `email_messages`), **Events:** **Insert**, **URL:** `https://<project-ref>.supabase.co/functions/v1/livechat-send-push`, **Headers:** `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`.
2. **JWT verification** — Deploy with `--no-verify-jwt` so the webhook (service role) can call the function:  
   `supabase functions deploy livechat-send-push --no-verify-jwt`
3. **FCM secret** — Edge Function **Secrets**: set **FCM_SERVICE_ACCOUNT_JSON** (Firebase service account JSON). Without it, FCM is skipped and only Web Push is sent.
4. **FCM token on device** — The app must have **notification permission** and must have saved the FCM token with **context = 'livechat'** to `fcm_tokens` (via `livechat-save-fcm-token`). The app now saves the same token for both `general` and `livechat` when registering push, so opening the app once while logged in is enough.
5. **Edge Function logs** — After sending an inbound message, check **Edge Functions** → **livechat-send-push** → **Logs** for `livechat-send-push: done` and `fcmSent` count.

6. **FCM 403 PERMISSION_DENIED / CONSUMER_INVALID** — If logs show `FCM API returned error` with **status 403** and message like "Permission denied on resource project **profitloop-28c71**":

   - **Enable Firebase Cloud Messaging API** for that project:
     - Open [Google Cloud Console](https://console.cloud.google.com/) and select the project (e.g. **profitloop-28c71**).
     - Go to **APIs & Services** → **Library** → search **"Firebase Cloud Messaging API"** or **"FCM"** → open it → click **Enable**.
   - **Service account permissions**: The service account whose JSON is in `FCM_SERVICE_ACCOUNT_JSON` must be allowed to use FCM. In **Firebase Console** → **Project Settings** → **Service accounts**, ensure the account has a role that includes FCM (e.g. **Firebase Admin SDK Administrator Service Agent** or **Editor**). The same project must be used in the Android app’s `google-services.json` and in the Edge Function secret.
   - After enabling the API and confirming the service account, trigger an inbound message again; `fcmSent` should become ≥ 1 and push should appear on the device.
