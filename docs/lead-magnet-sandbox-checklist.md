# Lead Magnet — Sandbox Checklist

## Prerequisites

- [ ] Instagram Business account connected at `/omnichannel/integrations/instagram`
- [ ] Facebook Page connected (for FB campaigns) at `/omnichannel/integrations/facebook`
- [ ] Webhook subscribed: `comments`, `messages`, `messaging_postbacks`, **`feed`** (wajib untuk komentar FB)
- [ ] Meta test user (not business account) for commenting

## Setup

1. Create campaign at `/digital-marketing/lead-magnet/new`
2. Bind a recent post/reel with test keyword (e.g. `mantab`)
3. Publish campaign (status `active`)

## E2E tests

1. [ ] Comment keyword from test user → public reply appears
2. [ ] DM follow gate in Request tab (if not follower)
3. [ ] **Facebook:** first `Sudah Follow` click (without following) → landing on office.synckerja.com + gate DM again, **no** material offer
3b. [ ] **Facebook:** follow Page → second `Sudah Follow` → single material offer DM
3c. [ ] **Instagram:** click `Sudah Follow` without following → same gate message (API check)
4. [ ] Follow account → click `Sudah Follow` → material offer DM (or delivery DM if skip material offer)
5. [ ] Click `Ambil Materi` → delivery DM + URL button (skip if material offer skipped)
5e. [ ] **Skip material offer ON** — after follow gate, delivery DM sent directly (no offer step)
5f. [ ] **Skip material offer + skip follow gate, follower** — comment → delivery DM directly
5b. [ ] **Upload mode** — upload PDF in Delivery step → publish → DM button downloads file from Supabase public URL
5c. [ ] **Link mode** — external HTTPS URL still works (regression)
5d. [ ] Switch link ↔ upload before publish; reject file >25 MB or `.exe` in UI
6. [ ] Second comment from same user → no re-trigger (dedup)
7. [ ] User already follower → skip follow gate (if enabled)
8. [ ] Analytics funnel shows step counts
9. [ ] Lead appears in CRM with source Lead Magnet
10. [ ] Assign agent in livechat → enrollment paused

## Contact Gate E2E (optional — `contact_gate_enabled`)

1. [ ] **Gate OFF** — existing flow unchanged (regression)
2. [ ] **Gate ON, new user** — after follow → DM asks WA/email → reply phone → **no IG ack from bot** → WA template received (no IG Unduh unless WA fails)
3. [ ] **Gate ON, email path** — reply email → Resend delivery (or IG fallback if Resend missing)
4. [ ] **Complete profile** — second campaign comment → DM IG link only (no contact ask)
5. [ ] **Invalid contact** — garbage reply → invalid DM, unlimited retry
6. [ ] **WA fail fallback** — broken/incomplete template mapping → IG DM with `delivery_fallback_text` + `delivery_whatsapp_failed` funnel event
7. [ ] Publish blocked without APPROVED WA template when org has WA account
8. [ ] Publish blocked when template slot count ≠ mapped `parameter_values` length
9. [ ] Re-save campaign with 7-var template — map all slots → WA delivers successfully (funnel `delivery_whatsapp_sent`)

## Troubleshooting

| Symptom | Check |
|---------|--------|
| WA not received, IG Unduh instead | Funnel `delivery_whatsapp_failed` — usually template param mismatch (#132000). Re-map all slots in Kontak & Channel or use 2-var UTILITY template |
| White "Phone number" card in IG after user sends number | **Instagram native UI** (Lead auto-detection) — not sent by Synckerja. Optional: review Lead labeling settings in Instagram Professional Inbox / Meta Business Suite |
| No comment reply | Edge logs `lead-magnet-runtime`; campaign active + post bound |
| No DM | 24h window / user must comment first; see `dm_failed` in analytics |
| Postback ignored | Payload prefix `lm:`; webhook `messaging_postbacks` subscribed (IG). FB uses action URLs on office.synckerja.com |
| Duplicate offer DMs | Should not occur after idempotency fix; check enrollment status stuck at `framework_offered` |
| FB comment no trigger | Page webhook **`feed`** belum subscribe — reconnect FB atau panggil subscribe di `/omnichannel/integrations/facebook`; cek `subscribedFields` harus ada `feed` |
