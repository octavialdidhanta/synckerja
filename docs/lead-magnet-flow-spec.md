# Lead Magnet Automation — Product Spec

ManyChat-style automation for Instagram and Facebook Page: comment keyword → public reply → DM follow gate → framework delivery.

## Workflow

1. **Comment match** — Webhook `comments` (IG) or `feed` item=comment (FB Page)
2. **Public comment reply** — `replyMetaComment`
3. **Follow check** — Graph API `is_user_follow_business` (Instagram only; Facebook has no public follow API for Messenger PSID). Pre-DM `false` is treated as **unknown** (Meta often lacks messaging consent right after a comment). When `skip_follow_gate_if_follower` is enabled on IG, runtime sends a short **consent opener** private reply, re-checks follow status, then either skips to material/delivery or sends follow gate via standard DM.
4. **Follow gate DM** — IG: postback `Sudah Follow`. FB: two buttons — `Ikuti Page` (facebook.com) + `Sudah Follow` (action URL on `office.synckerja.com/digital-marketing/lead-magnet/action`)
5. **Follow re-validation** — IG: API re-check on confirm; loop if false. FB: **two-step honor system** — first `Sudah Follow` click nudges + re-sends gate (no material); second click sends material offer
6. **Material offer** — `Ambil Materi` action URL (FB) or postback (IG); skippable via `skip_material_offer`
7. **Delivery** — DM with `web_url` button to HTTPS asset URL

### Instagram skip-if-follower (Meta consent timing)

Meta User Profile `is_user_follow_business` requires messaging consent. A comment alone often yields `false` even when the user already follows the account.

When `skip_follow_gate_if_follower` is **on** for an Instagram campaign:

1. Initial follow check runs (true → skip straight to material/delivery).
2. If not confirmed follower, send one **text-only private reply** opener (`Hai {{username}}! Sebentar ya…`) to open the messaging window (uses the single allowed private reply per comment).
3. Re-check `is_user_follow_business` with messaging window open.
4. Follower → skip follow gate (`follow_gate_skipped_follower` funnel event) and send material/delivery via standard DM.
5. Non-follower or still unknown → send follow gate via standard DM (conservative fallback for non-followers).

Funnel events: `follow_rechecked_after_opener`, `follow_gate_skipped_follower` (metadata includes `follow_status_before` / `follow_status_after`).

### Facebook follow gate limitation

Meta does not expose `is_user_follow_business` for Facebook Page Messenger users (PSID). Synckerja uses a two-step flow: first confirm click opens landing page + re-sends gate; second confirm click advances to material offer. This adds friction similar to ManyChat fallbacks but cannot cryptographically prove a Page follow.

### Action landing page

Public route: `/digital-marketing/lead-magnet/action?e=&a=&t=&s=` (signed; legacy `/lead-magnet/action`). SPA calls `lead-magnet-runtime/action` with `Accept: application/json`.

### Idempotency

Enrollment status transitions use atomic `UPDATE … WHERE status = …` before sending offer/delivery DMs to prevent duplicate messages on double-tap.

### Skip options (campaign settings)

| Flag | Effect |
|------|--------|
| `skip_follow_gate_if_follower` | Skip follow gate DM when user is a confirmed follower (IG: includes post-opener re-check) |
| `skip_material_offer` | After follow gate (or directly for follower + skip follow gate), send delivery DM without material-offer step |

### Contact Gate (optional, default OFF)

When `contact_gate_enabled` is **on** for a campaign:

1. Material offer is **always skipped** (`skip_material_offer` forced true on save/publish).
2. After follow validation (or skip-follow path), runtime checks canonical profile (`lead_magnet_participant_profiles` per org + PSID).
3. **Skip matrix** (Instagram v1):
   - Not follower → follow gate → contact prompt → async delivery
   - Follower, no WA/email → single DM asks for phone **or** email (WA priority if both empty across campaigns)
   - Follower gives phone **this enrollment** → WhatsApp template delivery → **enrollment ends** (no follow-up IG DM for email)
   - Follower gives email **this enrollment** → Resend email delivery → **enrollment ends** (no follow-up IG DM for phone)
   - Follower, WA only **in canonical profile** (returning user / **new enrollment**) → ask email → email delivery
   - Follower, email only **in canonical profile** (returning user / **new enrollment**) → ask WA → WhatsApp template delivery
   - Follower, WA + email complete → **DM IG link only** (direct delivery, no contact ask)
4. Inbound IG text while enrollment `awaiting_contact` → `parseContactReply` → **no IG ack DM** → WA template or Resend email async via `waitUntil`; on failure → fallback DM IG with download link (`delivery_fallback_text`).
5. After `delivered_whatsapp` or `delivered_email`, further inbound IG messages on **the same enrollment** are ignored (terminal state).
6. No skip keyword (`lewati` / `skip` not supported). Unlimited retry on invalid format until 24h window expires.

**Instagram native UI:** When a user sends a phone number, Instagram may show a client-side "Phone number" card with WhatsApp/Call buttons and label the chat as Lead ("Auto-detected outcome"). This is **not** sent by Synckerja and cannot be disabled via Messaging API. Synckerja does not send a second confirmation DM after valid contact.

**Default contact prompt copy** (professional ID, configurable in wizard):
- **Both WA/email:** explains materi dikirim via WhatsApp or email after user replies
- **Phone-only / email-only scenarios:** runtime uses dedicated templates (not the campaign `contact_prompt_text` field)

**Wizard:** step **Kontak & Channel** (between Pesan & Delivery) — prompt texts, APPROVED WA template picker with **per-slot variable mapping**, optional email HTML, and **IG fallback copy** (`delivery_fallback_text`). Publish requires WA template + complete mapping if org has active WA account.

**WhatsApp template params** (`whatsapp_template_params` JSON on campaign):

```json
{
  "components_json": [ /* Meta template components at save time */ ],
  "parameter_values": ["{{username}}", "-", "…", "{{delivery_url}}"]
}
```

- Slots follow Meta order: HEADER text vars → BODY vars → dynamic URL button vars.
- Supported tokens per slot: `{{username}}`, `{{delivery_url}}`, `{{campaign_name}}`, static text, or `-` (empty).
- **Recommended:** UTILITY template with **2 body variables** (username + link). Multi-var business templates (e.g. 7 vars) are supported when all slots are mapped.
- Legacy `{ "body": ["{{username}}", "{{delivery_url}}"] }` still works for old campaigns; re-publish with mapper after upgrade.
- Runtime uses `buildGraphTemplateComponents` (canonical Graph API builder) — publish rejects slot count mismatch.

**Fallback IG copy:** when async WA/email fails after valid contact, runtime sends `delivery_fallback_text` (not the normal `delivery_text`) with the download button.

**Funnel events:** `contact_prompt_sent`, `contact_collected`, `contact_invalid`, `delivery_whatsapp_sent|failed`, `delivery_email_sent|failed`, `delivery_instagram_sent`.

**SLA metric:** log `delivery_channel` on `contact_collected` funnel metadata; async WA/email delivery logs `lm_delivery_latency_ms` on success events.

### Delivery modes (wizard Delivery step)

| Mode | Source | `delivery_url` |
|------|--------|----------------|
| `link` | User-entered HTTPS URL (Drive, Notion, landing page) | Same URL |
| `upload` | File in public bucket `lead-magnet-assets` (PDF/DOCX/XLSX/PPTX, max 25 MB) | Public Supabase Storage URL after upload |

Both modes use the same runtime path: `sendDeliveryMessage` with a `web_url` button. Upload mode stores file metadata on `lead_magnet_campaigns` (`delivery_storage_path`, `delivery_file_name`, etc.).

## Storage

- Bucket: `lead-magnet-assets` (public read)
- Path: `{organization_id}/{campaign_id}/{uuid}_{filename}`

## Edge functions

| Function | Role |
|----------|------|
| `instagram-webhook` | Ingress; schedules `lead-magnet-runtime` |
| `lead-magnet-runtime` | State machine worker (service role) |
| `lead-magnet-api` | Campaign CRUD, publish, analytics (JWT) |

## Database

- `lead_magnet_campaigns`
- `lead_magnet_campaign_posts`
- `lead_magnet_enrollments`
- `lead_magnet_funnel_events`
- `lead_magnet_participant_profiles` (canonical WA/email per PSID)
- Extended `lead_submissions` (`lead_magnet_*` columns)

## UI

- `/digital-marketing/lead-magnet` — list & wizard
- `/omnichannel/settings/lead-magnet` — quick link card
- `/digital-marketing/lead-magnet/action` — public Messenger action landing (follow confirm / get framework)

## Deploy

```bash
npm run supabase:db:push
npx supabase functions deploy lead-magnet-api lead-magnet-runtime instagram-webhook --no-verify-jwt
```

## Meta permissions

- `instagram_manage_comments`
- `instagram_manage_messages`
- `pages_messaging`
- Webhook fields: `comments`, `messages`, `messaging_postbacks`, `feed` (FB comments)
