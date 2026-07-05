# Automation Flow Builder

SleekFlow-style **Automation Flow** for Synckerja omnichannel livechat (WhatsApp MVP).

## Naming

| Term | Meaning |
|------|---------|
| **Automation Flow** | Visual trigger → condition → action graph stored in Supabase |
| **WhatsApp Form Flow** | Meta interactive form flows via Graph API (`whatsapp-flows` edge function) |

## Routes

- Listing: `/omnichannel/settings/flow-builder/listing`
- Usage: `/omnichannel/settings/flow-builder/usage`
- Meta form flows: `/omnichannel/settings/flow-builder/form-flows`
- Editor: `/omnichannel/flow-builder/:flowId/editor`

## Runtime

1. `whatsapp-webhook` persists inbound message → invokes `flow-runtime`
2. `flow-runtime` matches active flows, creates enrollment, walks graph
3. `flow-runtime-send` sends WhatsApp message without assignee gate (`source = flow_automation`)
4. Assignee set on conversation → DB trigger pauses enrollments
5. `flow-delay-worker` processes due delay jobs (schedule via cron)

## Edge functions

- `automation-flow-api` — CRUD + publish (JWT)
- `flow-runtime` — service role only
- `flow-runtime-send` — service role only
- `flow-delay-worker` — service role only

## Phases delivered

- Phase 0–2: DB, editor, runtime MVP (send + delay + condition + labels)
- Phase 3: wait for reply, update contact nodes
- Phase 4: HTTP action, usage tab
- Phase 5: Meta form flows tab, run events, soft limit

See [docs/automation-flow-spec.md](../../docs/automation-flow-spec.md) for product spec.
