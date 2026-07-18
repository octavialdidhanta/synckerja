# Lead Magnet Automation — Product Spec

ManyChat-style automation for Instagram and Facebook Page: comment keyword → public reply → Opening DM → follow gate → delivery.

## Workflow (opening-first, `dm_flow_version = 2`)

1. **Comment match** — Webhook `comments` (IG) or `feed` item=comment (FB Page)
2. **Public comment reply** — `replyMetaComment`
3. **Opening DM** — ManyChat-style first DM with CTA button (`framework_offer_text` / `get_framework` postback). Uses Instagram private reply when first contact (replaces legacy consent opener). Skippable via `skip_material_offer` → go straight to follow gate at comment time.
4. **Opening button click** — Follow check runs with messaging window open. Confirmed Meta follower → skip follow gate (even when Follow Gate toggle is ON) and advance to delivery/contact gate. Non-follower / unknown → follow gate DM (when Follow Gate toggle is ON). When Follow Gate toggle is OFF (`skip_follow_gate_if_follower = true`), follow gate is never sent.
5. **Follow gate DM** — IG: postback `Sudah Follow`. FB: two buttons — `Ikuti Page` + `Sudah Follow` (action URL)
6. **Follow re-validation** — IG + FB: Meta API re-check on every confirm click; retry until follower (no honor bypass)
7. **Delivery** — DM with download link (or Contact Gate async channels)

### Legacy flow (`dm_flow_version = 1`)

Enrollments created before opening-first rollout keep the old order: follow gate → material offer → delivery. Postback routing branches on `dm_flow_version`.

## Workflow (detail)

1. **Comment match** — Webhook `comments` (IG) or `feed` item=comment (FB Page)
2. **Public comment reply** — `replyMetaComment`
3. **Opening DM (v2)** or **Follow check + follow gate (v1 / skip opening)** — see above
4. **Follow gate DM** — when required after Opening click or when opening skipped
5. **Follow re-validation** — IG + FB: API re-check on every confirm; loop retry DM if not follower (or unknown). No honor bypass.
6. **Delivery** — DM with `web_url` button to HTTPS asset URL (v2: after follow validated; v1: after material offer click)

### Instagram Follow Gate skip (v2)

Flag `skip_follow_gate_if_follower` maps to the wizard **Aktifkan Follow Gate** toggle (inverted):

- **Toggle ON** (`skip_follow_gate_if_follower = false`): after Opening button click (messaging window open), Meta `follower` → skip Follow Gate DM and advance to email/delivery matrix; `non_follower` / `unknown` → send Follow Gate.
- **Toggle OFF** (`skip_follow_gate_if_follower = true`): never send Follow Gate; always advance to email/delivery matrix.
- When `skip_material_offer` is on (no Opening), the same skip rules run at comment time (with consent opener recheck on IG first contact when gate is ON and status is not yet `follower`).

Legacy v1 enrollments use the same `shouldSkipFollowGate` helper.

### Instagram Follow Gate consent recheck (v1 / skip-opening)

Meta User Profile `is_user_follow_business` requires messaging consent. A comment alone often yields `false` even when the user already follows the account.

When Follow Gate is **ON** for a **v1** / skip-opening Instagram path and status is not yet `follower`:

1. Initial follow check runs (`follower` → skip straight to material/delivery).
2. If not confirmed follower, send one **text-only private reply** opener (`Hai {{username}}! Sebentar ya…`) to open the messaging window.
3. Re-check `is_user_follow_business` with messaging window open.
4. Follower → skip follow gate and send material/delivery via standard DM.
5. Non-follower → send follow gate via standard DM.

When Follow Gate is **OFF**, step 2–5 are skipped (no Follow Gate DM).

Funnel events: `follow_rechecked_after_opener`, `follow_gate_skipped_follower`.

### Facebook follow gate limitation

Meta often does not expose a reliable `is_user_follow_business` for Facebook Page Messenger users (PSID). Synckerja still re-checks Meta on every confirm click and retries when status is not `follower` (including `unknown`). Page follow cannot always be proven cryptographically; if Meta never returns `follower`, the gate will keep sending the retry DM.

### Action landing page

Public route: `/digital-marketing/lead-magnet/action?e=&a=&t=&s=` (signed; legacy `/lead-magnet/action`). SPA calls `lead-magnet-runtime/action` with `Accept: application/json`.

### Idempotency

Enrollment status transitions use atomic `UPDATE … WHERE status = …` before sending offer/delivery DMs to prevent duplicate messages on double-tap.

### Skip options (campaign settings)

| Flag | Effect |
|------|--------|
| `skip_material_offer` | Skip Opening DM; send follow gate right after comment |
| `skip_follow_gate_if_follower` | Wizard inverted: `true` = Follow Gate OFF (never send). `false` = Follow Gate ON — skip DM only when Meta confirms `follower`; otherwise send Follow Gate |
| `email_collection_enabled` | After follow validated, ask for email; material sent via **IG DM** after valid email (email stored as lead) |
| `contact_gate_enabled` | **WhatsApp Delivery** for returning users who already have email — ask phone → WA template |

### Email Collection (wizard step **Pesan**, default OFF)

When `email_collection_enabled` is **on**:

1. Compatible with Opening DM and Follow Gate (no forced skip).
2. After follow validation (`follow_validated`) and confirmed follower, runtime sends email prompt DM → `awaiting_contact` (`awaiting_contact_kind = email`).
3. User replies with valid email → profile upsert → **IG DM delivery** (`sendDeliveryMessage`) — material is **not** sent before email is collected.
4. Invalid email → unlimited retry via `contact_invalid_text` until 24h window expires.
5. Email is lead capture only; first-time delivery is always via Instagram DM link button.

### WhatsApp Delivery (wizard step **Kontak & Channel**, default OFF)

When `contact_gate_enabled` is **on** (returning-user path):

1. After follow validated, if canonical profile **already has email** but no phone → ask WhatsApp number → template delivery.
2. Requires APPROVED WA template + mapping when org has active WhatsApp account.
3. On WA failure → fallback IG DM with `delivery_fallback_text`.

**Combined skip matrix (v2, after follow validated):**

| Follower | Profile | Next step |
|----------|---------|-----------|
| No | any | Follow gate (no email prompt) |
| Yes | no email + email collection ON | Ask email → IG DM delivery |
| Yes | has email, no phone + WA gate ON | Ask phone → WA template |
| Yes | email + phone complete | Direct IG DM delivery |
| Yes | gates OFF | Direct IG DM delivery (standard v2) |

**Wizard:** step **Pesan** — toggle Koleksi Email, email prompt/invalid copy. Step **Kontak & Channel** — WhatsApp Delivery toggle, WA template mapper, IG fallback copy.

**Legacy note:** Campaigns with old `contact_gate_enabled` were migrated to also enable `email_collection_enabled`. First-time email delivery no longer uses Resend — IG DM only.

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

ManyChat-style: one delivery DM text + up to **3** link buttons (`delivery_links` jsonb: `{ label, url }[]`).

| Source | Behavior |
|--------|----------|
| HTTPS URL | Manual URL per slot (Drive, Notion, landing page) |
| Upload (slot #1 only) | File in public bucket `lead-magnet-assets` → public URL fills link #1 |

**Publish rules:** min 1 / max 3 links; each needs non-empty label (≤20 Meta chars) + valid HTTPS URL.

**Runtime:** `sendDeliveryMessage` builds one IG/FB `button_template` with up to 3 `web_url` buttons. Each button uses a signed download URL with index `i=0|1|2` that 302-redirects to `delivery_links[i].url`.

**Legacy mirror:** `delivery_url` and `delivery_button_label` always mirror link #1 for WA template `{{delivery_url}}` and older code paths.

Upload mode still stores file metadata on `lead_magnet_campaigns` (`delivery_storage_path`, `delivery_file_name`, etc.) when slot #1 was filled via upload.

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
npm run supabase:functions:deploy:lead-magnet-all
# or: node scripts/deploy-lead-magnet-functions.mjs
# requires SUPABASE_ACCESS_TOKEN (sbp_...) from https://supabase.com/dashboard/account/tokens
```

Functions to redeploy after delivery multi-link changes: `lead-magnet-api`, `lead-magnet-runtime`, `instagram-webhook` (shared `deliveryLinks` / signed download index).

## Meta permissions

- `instagram_manage_comments`
- `instagram_manage_messages`
- `pages_messaging`
- Webhook fields: `comments`, `messages`, `messaging_postbacks`, `feed` (FB comments)
