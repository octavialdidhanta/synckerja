# whatsapp-template-header-upload

Resumable upload to Meta for WhatsApp **message template** header media (`IMAGE` / `VIDEO` / `DOCUMENT`). Returns `header_handle` for use in `CreateTemplateWizard` → `whatsapp-message-templates` POST.

**Deploy:** `supabase functions deploy whatsapp-template-header-upload`

**Secrets:** set `META_APP_ID` to your **numeric Meta App ID** (same app as WhatsApp product in developers.facebook.com). Graph resumable upload for template headers uses `POST /v18.0/{META_APP_ID}/uploads`, not `phone_number_id` (that ID is valid for Live Chat messaging but often returns “Unsupported post request” for `/uploads`).

Requires active org with `meta_access_token` (from `organization_meta_config` or `organization_whatsapp_accounts`, same as sending messages).
