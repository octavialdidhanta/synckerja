# Lead Magnet Automation — Product Spec

ManyChat-style automation for Instagram and Facebook Page: comment keyword → public reply → DM follow gate → framework delivery.

## Workflow

1. **Comment match** — Webhook `comments` (IG) or `feed` item=comment (FB Page)
2. **Public comment reply** — `replyMetaComment`
3. **Follow check** — Graph API `is_user_follow_business` (Instagram only; Facebook has no public follow API for Messenger PSID)
4. **Follow gate DM** — IG: postback `Sudah Follow`. FB: two buttons — `Ikuti Page` (facebook.com) + `Sudah Follow` (action URL on `office.synckerja.com/digital-marketing/lead-magnet/action`)
5. **Follow re-validation** — IG: API re-check on confirm; loop if false. FB: **two-step honor system** — first `Sudah Follow` click nudges + re-sends gate (no material); second click sends material offer
6. **Material offer** — `Ambil Materi` action URL (FB) or postback (IG); skippable via `skip_material_offer`
7. **Delivery** — DM with `web_url` button to HTTPS asset URL

### Facebook follow gate limitation

Meta does not expose `is_user_follow_business` for Facebook Page Messenger users (PSID). Synckerja uses a two-step flow: first confirm click opens landing page + re-sends gate; second confirm click advances to material offer. This adds friction similar to ManyChat fallbacks but cannot cryptographically prove a Page follow.

### Action landing page

Public route: `/digital-marketing/lead-magnet/action?e=&a=&t=&s=` (signed; legacy `/lead-magnet/action`). SPA calls `lead-magnet-runtime/action` with `Accept: application/json`.

### Idempotency

Enrollment status transitions use atomic `UPDATE … WHERE status = …` before sending offer/delivery DMs to prevent duplicate messages on double-tap.

### Skip options (campaign settings)

| Flag | Effect |
|------|--------|
| `skip_follow_gate_if_follower` | Follower at comment time skips follow gate DM |
| `skip_material_offer` | After follow gate (or directly for follower + skip follow gate), send delivery DM without material-offer step |

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
