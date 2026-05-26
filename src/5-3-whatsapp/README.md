# WhatsApp, Instagram & Email (5-3-whatsapp)

Fitur integrasi WhatsApp Business API, Instagram, dan Email untuk area Operations → Consultant.

## Path

- **Connect WhatsApp:** `/omnichannel/integrations/whatsapp` — form Business Account ID, Access Token, Verify Token, Phone Number ID; tampilan Webhook Callback URL.
- **Connect Instagram:** `/omnichannel/integrations/instagram` — OAuth Meta; daftar akun Instagram terhubung.
- **Connect Email:** `/omnichannel/integrations/email` — tambah email, alamat inbound untuk forwarding Gmail; daftar akun email terhubung.
- **Inbox (Live Chat):** `/omnichannel/livechat` — daftar percakapan (WhatsApp, Instagram, Email), chat thread, form balas.

## Struktur

- `pages/` — WhatsAppConnectPage, WhatsAppInboxPage, InstagramConnectPage, EmailConnectPage, MetaOAuthCallbackPage
- `components/connect/` — WhatsAppConnectForm, WebhookInfoDisplay
- `components/inbox/` — ConversationList, ChatThread, EmailChatThread, LivechatQuickActionPanel, SearchConversationPopup
- `hooks/` — useWhatsAppConfig, useWhatsAppConversations, useWhatsAppMessages, useSendWhatsAppMessage; useEmailConnections, useEmailConversations, useEmailMessages
- `types/` — WhatsAppConfig, WhatsAppConversation, WhatsAppMessage; EmailConnection, EmailConversation, EmailMessage, LiveChatConversation

## Backend

- **Tabel:** `organization_meta_config` (token Meta + konfig WhatsApp/FB/IG), `organization_whatsapp_accounts`, `whatsapp_conversations`, `whatsapp_messages`; `organization_email_connections`, `email_conversations`, `email_messages` (RLS per org).

### Assignee policy (hybrid after Resolve)

| Field | Meaning |
|-------|---------|
| `assignee_id` | **Active** operational owner (In Progress, composer send, Idle Agents). Cleared on resolve (Option A). |
| `last_handling_assignee_id` | Agent who **closed** the current resolve/expired cycle. Used for **post-resolve livechat list** visibility (non-owner) and aligns with survey snapshot; **not** used for idle/active chat counts. |

**Livechat list (non-owner/admin):** RPC `get_*_conversations_with_preview` shows a room when `assignee_id = me`, or when `assignee_id` is null, status is Resolve/Closed/Expired, and `last_handling_assignee_id = me`. Instagram also shows **unassigned non-terminal** rooms to all roster agents (queue).

**Send (exclusive assignee):** Only the employee matching live `assignee_id` may send free-form messages (WA/IG/Email), use **Quick Action** (status, resolve, converted, follow-up updates, service/category), or click **Resolve** in the header. Owner/Admin have **no** override. Unassigned chats cannot be acted on until assignee is set in Leads Management. Edge functions return `NOT_ASSIGNEE` if another agent attempts send.

**Follow-up:** `send-whatsapp-template-followup` auto-assigns the sender when `assignee_id` is null (Resolve/Expired). If assignee already exists, only that assignee may send follow-up. Survey enqueue still uses `COALESCE(NEW.assignee_id, OLD.assignee_id)` on resolve.

**View vs send:** Owner/Admin may still **see** all rooms in the list; exclusive assignee applies to **composer/send** only.
- **Edge Function:** `whatsapp-webhook` — GET (verification), POST (simpan pesan masuk, map org by phone_number_id). URL: `{SUPABASE_URL}/functions/v1/whatsapp-webhook`.
- **Edge Function:** `send-whatsapp-message` — POST (kirim pesan via Meta API, simpan outbound ke DB). URL: `{SUPABASE_URL}/functions/v1/send-whatsapp-message`. Auth: JWT.
- **Edge Function:** `email-inbound` — POST (webhook Resend `email.received`; simpan pesan ke `email_conversations`/`email_messages`, ekstrak kode verifikasi Gmail). URL: `{SUPABASE_URL}/functions/v1/email-inbound`.

## Env (Email Connect)

- **VITE_EMAIL_INBOUND_DOMAIN** — Domain untuk alamat inbound (hanya domain, tanpa `@`). Contoh: `profitloop.id`. Harus sama dengan domain yang dikonfigurasi di Resend Inbound dan MX-nya mengarah ke Resend. Jika tidak di-set, fallback `chat.example.com` (hanya untuk development; email tidak akan sampai).

## Integrasi

- Route di `App.tsx`; permission di `routePermissions.ts`; tab di `5-3-dashboard/components/layout/HeaderAndTab.tsx`.
