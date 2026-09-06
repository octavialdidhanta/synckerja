# Lead identity Fase 4 — Typo email + identity graph

Strict identity follow-up after Fase 3 (exact phone/email soft-merge).

## What this does

| Step | RPC | Effect |
|------|-----|--------|
| **4a** | `merge_typo_email_leads_dry_run` / `_execute` | Soft-merge invalid typo emails (e.g. `gmail.comsss`) into the single matching valid email (same local-part + domain stem) |
| **4b** | `merge_identity_graph_leads_dry_run` / `_execute` | Soft-merge lead components connected by shared phone key or email key (a lead with **both** bridges phone-only and email-only leads) |
| **CLV UI** | `groupCustomerClv` | Groups by identity component (union-find), same bridge rules |

**Not linked:** same display name only; receipt invitation edges; manual link table.

## Order (required)

1. Dry-run **4a** → review → `execute(..., true)`
2. Dry-run **4b** → review → `execute(..., true)`
3. Refresh `/operations/customers-list`

## Synckerja Office example

```sql
-- 4a
SELECT public.merge_typo_email_leads_dry_run(
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
);
SELECT public.merge_typo_email_leads_execute(
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  true
);

-- 4b
SELECT public.merge_identity_graph_leads_dry_run(
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid
);
SELECT public.merge_identity_graph_leads_execute(
  '663c9336-8cb6-4a36-9ad9-313126e70a1a'::uuid,
  true
);
```

Expect 4a to pick up `papadhanta@gmail.comsss` → `papadhanta@gmail.com` when that pair exists.  
Expect 4b **not** to merge `papadhanta@…` with `Octa Vialdi` phone unless a bridge lead has that phone **and** that email.

## Code

- Typo / graph pure logic + RPC clients: [`src/5-2-customer-visits/leads-identity-merge/`](../../src/5-2-customer-visits/leads-identity-merge/)
- CLV: [`buildCustomerIdentityComponents.ts`](../../src/8-2-7-customers/lib/buildCustomerIdentityComponents.ts), [`groupCustomerClv.ts`](../../src/8-2-7-customers/lib/groupCustomerClv.ts)
- Migration: `supabase/migrations/20260930705000_leads_identity_fase4_typo_graph.sql`

## Auth

Same as Fase 3: Supabase SQL Editor (`postgres`), `service_role`, or org member JWT.

## Multi-org typo ops (4a checklist)

POS Add Customer now captures optional email so new checkouts more often create a single lead with phone+email (future 4b bridges). Historis typo cleanup remains **ops-only** — no admin UI. For each org that needs 4a:

1. **List org IDs** you intend to clean (SQL Editor or internal roster). Example:

```sql
SELECT id, name
FROM public.organizations
ORDER BY name;
```

2. **Dry-run 4a** per org — review `mergeable_count` / sample pairs before any write:

```sql
SELECT public.merge_typo_email_leads_dry_run('<org_uuid>'::uuid);
```

3. If the dry-run looks correct, **execute** with confirm:

```sql
SELECT public.merge_typo_email_leads_execute('<org_uuid>'::uuid, true);
```

4. Optionally run **4b dry-run** after 4a settles (only merges when a bridge lead already has both phone and email — name-only matches stay unlinked).

5. Refresh `/operations/customers-list` for that org.

Do **not** auto-run all orgs in one script without reviewing each dry-run. Typo merges are irreversible soft-archives (`merged_into_lead_id`).

## Next: checkout bridge (Fase 5)

Phone-only ↔ email-only pairs (e.g. historis Octa ↔ papadhanta) need an explicit checkout bridge, not 4a typo. See [lead-identity-fase5-checkout-bridge.md](./lead-identity-fase5-checkout-bridge.md).
