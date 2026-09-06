# Lead identity Fase 5 — Checkout bridge + harden ensure

Soft-merge when POS checkout (or ops) supplies a **phone-anchored lead** and a different **email-anchored lead** in one call. Complements Fase 4b (graph needs a bridge row with both contacts).

## What this does

| Piece | Effect |
|------|--------|
| **Harden ensure** | Phone reuse fills email only if empty; email reuse fills phone only if empty |
| **Dual lookup** | Email is looked up even when phone already matched |
| **RPC** | `merge_checkout_identity_bridge_dry_run` / `_execute` — soft-merge pair → `lead_merge_events.cluster_kind = checkout_bridge` |
| **Ambiguous attributed** | Skip merge; checkout continues on phone lead without attaching the conflicting email |

**Not linked:** same display name only; receipt invitation edges; manual link table / admin UI.

## Order (historis Synckerja Office)

Org: `663c9336-8cb6-4a36-9ad9-313126e70a1a`

1. Find active phone lead (e.g. Octa) and active email lead (e.g. papadhanta):

```sql
SELECT id, client, phone_number, email
FROM public.leads
WHERE organization_id = '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
  AND merged_into_lead_id IS NULL
  AND (
    public.normalize_wa_phone_key(phone_number) IS NOT NULL
    OR NULLIF(btrim(email), '') IS NOT NULL
  )
ORDER BY updated_at DESC NULLS LAST;
```

2. Dry-run bridge with the two UUIDs:

```sql
SELECT public.merge_checkout_identity_bridge_dry_run(
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  '<phone_lead_uuid>'::uuid,
  '<email_lead_uuid>'::uuid
);
```

3. If `skipped` is false, execute:

```sql
SELECT public.merge_checkout_identity_bridge_execute(
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  '<phone_lead_uuid>'::uuid,
  '<email_lead_uuid>'::uuid,
  true
);
```

**Note:** Soft-merge clears loser phone/email **before** filling the winner (migration `20260930706100_…`). Checkout bridge prefers the **phone** lead as winner. Replace placeholders with real UUIDs (do not leave `<phone_lead_uuid>` literally).

If winner already has a different email, `papadhanta@…` on the email-only loser is archived/cleared and **not** copied onto the winner (fill-empty only).

4. Optional **4b** if other components remain:

```sql
SELECT public.merge_identity_graph_leads_dry_run(
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
);
-- then execute(..., true) if mergeable_count > 0
```

5. Refresh `/operations/customers-list`.

Going forward, Add Customer / Pay with phone+email that hit two leads runs the same bridge automatically via `ensurePosCheckoutLead`.

## Multi-org typo (4a)

Still ops-only checklist — see [lead-identity-fase4-typo-graph.md](./lead-identity-fase4-typo-graph.md) (list org → dry_run 4a → execute). Do not auto-run all orgs.

## POS smoke checklist

- [ ] Add Customer: phone + valid optional email → Save → cart shows member
- [ ] Typo email (`gmail.comsss`) rejected in dialog
- [ ] Phone only still saves
- [ ] Guest without phone: no email CRM bind
- [ ] Pay (cash/QRIS): lead has phone and email when both were captured
- [ ] After deploy: Pay with phone of lead A + email of lead B → one winner; loser soft-archived (`merged_into_lead_id`)

## Code

- Migration: `supabase/migrations/20260930706000_leads_checkout_identity_bridge.sql`
- Ensure: [`ensurePosCheckoutLead.ts`](../../src/5-2-customer-visits/checkout/pos-bind/ensurePosCheckoutLead.ts), [`attachPosCheckoutContactIfEmpty.ts`](../../src/5-2-customer-visits/checkout/pos-bind/attachPosCheckoutContactIfEmpty.ts)
- Bridge package: [`leads-identity-merge/bridge/`](../../src/5-2-customer-visits/leads-identity-merge/bridge/)

## Auth

Same as Fase 3/4: Supabase SQL Editor (`postgres`), `service_role`, or org member JWT.
