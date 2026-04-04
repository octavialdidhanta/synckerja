# WhatsApp, Instagram & Email (5-3-whatsapp)

Fitur integrasi WhatsApp Business API, Instagram, dan Email untuk area Operations → Consultant.

## Path

- **Connect WhatsApp:** `/operations/consultant/whatsapp/connect` — form Business Account ID, Access Token, Verify Token, Phone Number ID; tampilan Webhook Callback URL.
- **Connect Instagram:** `/operations/consultant/instagram/connect` — OAuth Meta; daftar akun Instagram terhubung.
- **Connect Email:** `/operations/consultant/email/connect` — tambah email, alamat inbound untuk forwarding Gmail; daftar akun email terhubung.
- **Inbox (Live Chat):** `/operations/consultant/all/livechat` — daftar percakapan (WhatsApp, Instagram, Email), chat thread, form balas.

## Struktur

- `pages/` — WhatsAppConnectPage, WhatsAppInboxPage, InstagramConnectPage, EmailConnectPage, MetaOAuthCallbackPage
- `components/connect/` — WhatsAppConnectForm, WebhookInfoDisplay
- `components/inbox/` — ConversationList, ChatThread, EmailChatThread, LivechatQuickActionPanel, SearchConversationPopup
- `hooks/` — useWhatsAppConfig, useWhatsAppConversations, useWhatsAppMessages, useSendWhatsAppMessage; useEmailConnections, useEmailConversations, useEmailMessages
- `types/` — WhatsAppConfig, WhatsAppConversation, WhatsAppMessage; EmailConnection, EmailConversation, EmailMessage, LiveChatConversation

## Backend

- **Tabel:** `organization_meta_config` (token Meta + konfig WhatsApp/FB/IG), `organization_whatsapp_accounts`, `whatsapp_conversations`, `whatsapp_messages`; `organization_email_connections`, `email_conversations`, `email_messages` (RLS per org).
- **Edge Function:** `whatsapp-webhook` — GET (verification), POST (simpan pesan masuk, map org by phone_number_id). URL: `{SUPABASE_URL}/functions/v1/whatsapp-webhook`.
- **Edge Function:** `send-whatsapp-message` — POST (kirim pesan via Meta API, simpan outbound ke DB). URL: `{SUPABASE_URL}/functions/v1/send-whatsapp-message`. Auth: JWT.
- **Edge Function:** `email-inbound` — POST (webhook Resend `email.received`; simpan pesan ke `email_conversations`/`email_messages`, ekstrak kode verifikasi Gmail). URL: `{SUPABASE_URL}/functions/v1/email-inbound`.

## Env (Email Connect)

- **VITE_EMAIL_INBOUND_DOMAIN** — Domain untuk alamat inbound (hanya domain, tanpa `@`). Contoh: `profitloop.id`. Harus sama dengan domain yang dikonfigurasi di Resend Inbound dan MX-nya mengarah ke Resend. Jika tidak di-set, fallback `chat.example.com` (hanya untuk development; email tidak akan sampai).

## Integrasi

- Route di `App.tsx`; permission di `routePermissions.ts`; tab di `5-3-dashboard/components/layout/HeaderAndTab.tsx`.
