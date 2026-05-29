# livechat-assignment-send-push

Send **mobile native (FCM)** push notifications when a WhatsApp conversation is **assigned/reassigned**.

## When it runs

This function is intended to be invoked by a **Supabase Database Webhook** on:

- **Table**: `public.whatsapp_conversations`
- **Event**: `UPDATE`
- **Timeout**: 30 seconds recommended
- **URL**: `https://<project-ref>.supabase.co/functions/v1/livechat-assignment-send-push`
- **Headers**: `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`
- **Deploy**: `supabase functions deploy livechat-assignment-send-push --no-verify-jwt`

The function checks `record.assignee_id` vs `old_record.assignee_id` and **skips** if unchanged.

## Payload rules (current product requirement)

- Notify **new assignee** and **previous assignee** (if changed).
- **Skip** notification to the assignee when **self-assign** (actor == new assignee), using:
  - `whatsapp_conversations.last_assigned_by_user_id`
- Always push even when app is foreground (native controls banner/sound).

## Secrets

Set in Supabase Dashboard → Edge Functions → `livechat-assignment-send-push` → Secrets:

- `FCM_SERVICE_ACCOUNT_JSON` (required for native push)
- `FCM_PROJECT_ID` (optional, otherwise read from service account JSON)
- `LIVECHAT_APP_ORIGIN` (optional; base URL for deep links)

## Deep link payload

FCM `data` includes:

- `notificationType = livechat_assignment`
- `url = /omnichannel/livechat?conversation=<conversation_id>`
- `organization_id`
- `conversation_id`
- `ticket_id`

## Supabase Dashboard steps (copy/paste checklist)

1. Supabase Dashboard → **Edge Functions** → deploy `livechat-assignment-send-push` with `--no-verify-jwt`.
2. Supabase Dashboard → **Database** → **Webhooks** → **Create webhook**
   - Table: `public.whatsapp_conversations`
   - Events: `UPDATE`
   - URL: `https://<project-ref>.supabase.co/functions/v1/livechat-assignment-send-push`
   - Method: `POST`
   - Headers: `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`
3. Test: re-assign a chat from Leads Management and check Edge Function logs for `livechat-assignment-send-push: done`.

