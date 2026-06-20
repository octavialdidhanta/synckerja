# Facebook Messenger Livechat — App Review & Sandbox QA

Internal checklist for Meta **Advanced Access** and end-to-end Messenger livechat validation.

## Meta App Review scopes (Live)

Submit **Advanced Access** for:

| Scope | Use case in Synckerja |
|-------|------------------------|
| `pages_messaging` | Unified omnichannel inbox: read/send Messenger in `/omnichannel/livechat` |
| `pages_manage_metadata` | Subscribe Page webhooks (`messages`, `messaging_postbacks`, `message_reads`) on OAuth connect |

`pages_messaging` is already requested in Facebook Page OAuth (`META_FACEBOOK_PAGE_OAUTH_SCOPES`). Approval + active webhook are required for production (non-tester) users.

### Reviewer notes (suggested)

1. Connect a Facebook Page at `/omnichannel/integrations/facebook`.
2. Send a message to the Page from a personal Facebook account (in Dev mode: tester must be app admin/developer or Page role).
3. Open `/omnichannel/livechat` — conversation appears with **Messenger** badge (`FB-` ticket).
4. Assign agent, reply from Synckerja — message appears in Messenger app.
5. Optional: assignee, Resolve, SLA panel, push notification (desktop + mobile).

Webhook callback URL: `{SUPABASE_URL}/functions/v1/instagram-webhook` (same Meta app webhook; `object: page` → `facebook_*` tables).

## Sandbox QA checklist

1. [ ] Connect FB-only Page at `/omnichannel/integrations/facebook` → scope card **Messenger Live Chat** (`messenger_dm`) green.
2. [ ] Copy **Webhook Callback URL** + **Verify Token** from connect page → Meta Developer → Webhooks (Page) → Verify and Save → subscribe `messages`.
3. [ ] From personal Facebook (tester in Dev), message the Page.
4. [ ] Inbound appears in `/omnichannel/livechat` with Messenger icon; ticket prefix `FB-`.
5. [ ] Assignee set → agent reply → outbound in Messenger app.
6. [ ] Resolve / reopen on new inbound; SLA cycle created (`facebook_conversation_cycles`).
7. [ ] Push: inbound triggers `livechat-send-push` (`[Messenger]` title, channel `fb`).
8. [ ] Mobile app: same thread visible; tap notification opens `?ticket_id=FB-...`.
9. [ ] Page with linked IG: IG DMs stay Instagram channel; Messenger stays Facebook (no double insert).

## Deploy

```bash
supabase db push
npx supabase functions deploy instagram-webhook send-facebook-message meta-oauth-exchange livechat-send-push --no-verify-jwt
```

Optional DB webhook for push: enable `facebook_messages` INSERT trigger → `livechat-send-push` (same pattern as IG/WA if configured).

## Architecture reminders

- PSID ≠ IGSID — separate `facebook_conversations` / `instagram_conversations`.
- Webhook routing: `object: instagram` → IG tables; `object: page` → FB tables only.
- Outbound: `send-facebook-message` uses `organization_facebook_pages.page_access_token`.
