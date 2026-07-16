# Lead Magnet — Sandbox Checklist

## Prerequisites

- [ ] Instagram Business account connected at `/omnichannel/integrations/instagram`
- [ ] Facebook Page connected (for FB campaigns) at `/omnichannel/integrations/facebook`
- [ ] Webhook subscribed: `comments`, `messages`, `messaging_postbacks` (+ `feed` for FB comments)
- [ ] Meta test user (not business account) for commenting

## Setup

1. Create campaign at `/digital-marketing/lead-magnet/new`
2. Bind a recent post/reel with test keyword (e.g. `mantab`)
3. Publish campaign (status `active`)

## E2E tests

1. [ ] Comment keyword from test user → public reply appears
2. [ ] DM follow gate in Request tab (if not follower)
3. [ ] Click `Sudah Follow` without following → same gate message
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

## Troubleshooting

| Symptom | Check |
|---------|--------|
| No comment reply | Edge logs `lead-magnet-runtime`; campaign active + post bound |
| No DM | 24h window / user must comment first; see `dm_failed` in analytics |
| Postback ignored | Payload prefix `lm:`; webhook `messaging_postbacks` subscribed |
| FB comment no trigger | Page webhook `feed` field; campaign platform = facebook |
