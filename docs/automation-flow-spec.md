# Automation Flow — Product Spec

## Overview

Automation Flow is a visual workflow builder (SleekFlow parity) for WhatsApp livechat. It is **not** Meta WhatsApp Form Flow.

## Confirmed product decisions

- **Channel MVP:** WhatsApp only
- **Bot sends without assignee:** via dedicated `flow-runtime-send`
- **Assignee assigned:** pause enrollment (`assignee_taken_over`)
- **Storage:** Supabase tables + RLS
- **Canvas:** `@xyflow/react`
- **MVP runtime actions:** Send Message (manual) + Time Delay + Condition
- **Labels:** `omnichannel_labels` + `omnichannel_conversation_labels`
- **Create flow:** minimal wizard → full-page editor
- **Publish:** org owner + omnichannel admin only
- **Active flow limit:** soft warning at 100
- **Livechat:** badge "Automation" on bot messages

## Node catalog

| Node | Purpose |
|------|---------|
| `start` | Trigger `incoming_message_received`, WhatsApp account picker, enrollment filters |
| `condition` | Branch yes/no on keyword, label, conversation status |
| `action_send_message` | Manual session text with `{{contact.first_name}}` |
| `time_delay` | Schedule resume via `omnichannel_flow_delay_jobs` |
| `action_wait_reply` | Pause until next inbound (Phase 3) |
| `action_update_contact` | Update lead category/services (Phase 3) |
| `action_http_request` | POST external URL (Phase 4) |
| `end` | Complete enrollment |

## Re-enrollment

Default: `not_in_flow` — only enroll if no active/waiting enrollment for that flow + conversation.

## E2E test checklist

1. Create draft → configure start (WhatsApp account) → add Send Message → Publish
2. Send inbound WA message → bot reply appears in livechat with Automation badge
3. Add Time Delay → verify job row + worker resumes
4. Assign agent mid-flow → enrollment paused, no further bot sends
5. Non-admin publish → 403 from API

## Manual E2E (post-deploy)

```bash
# Deploy edge functions
npx supabase functions deploy automation-flow-api flow-runtime flow-runtime-send flow-delay-worker --no-verify-jwt

# Apply migration
npm run supabase:db:push

# Schedule delay worker (example: every minute via external cron)
curl -X POST "$SUPABASE_URL/functions/v1/flow-delay-worker" -H "Authorization: Bearer $SERVICE_ROLE_KEY"
```
