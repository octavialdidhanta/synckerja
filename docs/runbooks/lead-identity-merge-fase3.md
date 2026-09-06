# Lead identity merge (Fase 3) — Runbook

Soft-archive duplicate `leads` that share the same **normalized phone** or **email** within one organization. Does **not** union phone↔email identities.

## Prerequisites

1. Migration A applied: `20260930703000_leads_identity_merge_fase3.sql`
   - Columns: `leads.merged_into_lead_id`, `merged_at`, `merged_by`
   - Table: `lead_merge_events`
   - RPCs: `merge_customer_lead_duplicates_dry_run`, `merge_customer_lead_duplicates_execute`
2. App filters deployed (POS lookup + customers list ignore merged losers).
3. Migration B (`20260930704000_leads_identity_unique.sql`) **not** applied until cleanup is done for orgs that still have duplicates.

## Staging checklist

1. Pick one `organization_id`.
2. Dry-run (no writes):

```sql
SELECT public.merge_customer_lead_duplicates_dry_run('<organization_id>'::uuid);
```

Works from **Supabase SQL Editor** (postgres), `service_role`, or an authenticated org member. Replace `<organization_id>` with a real UUID (e.g. Synckerja Office: `663c9336-8cb6-4a36-9ad9-313126e70a1a`).

3. Review JSON:
   - `mergeable_count` — clusters that will merge
   - `skipped_count` — e.g. `ambiguous_attributed` (two Lead Magnet / `LEAD-*` leads) — **manual review**
   - Each cluster: `kind`, `cluster_key`, `winner_lead_id`, `loser_lead_ids`
4. Spot-check winner vs losers in CRM (attribution, name, ticket).
5. Execute (writes):

```sql
SELECT public.merge_customer_lead_duplicates_execute('<organization_id>'::uuid, true);
```

Without `true`, RPC raises `confirm_required`.

6. Re-run dry-run — expect `mergeable_count = 0` (or only remaining skipped clusters).
7. Verify:
   - `/operations/customers-list` — no soft-archived losers; CLV rows for merged keys collapsed
   - POS lookup by phone/email returns winner only
   - `SELECT * FROM lead_merge_events WHERE organization_id = '…' ORDER BY created_at DESC LIMIT 50;`
8. Repeat for other orgs as needed.

## Production order

1. Deploy Migration A + app filters.
2. Dry-run → review → execute **per org** (start with highest-duplicate orgs).
3. Resolve skipped `ambiguous_attributed` manually (or leave skipped).
4. When dry-run is clean across critical orgs, apply Migration B unique indexes.
5. If Migration B fails on unique violation, dry-run that org, execute again, then retry B.

## TypeScript helpers

Package: [`src/5-2-customer-visits/leads-identity-merge/`](../../src/5-2-customer-visits/leads-identity-merge/)

- `buildLeadMergeClusters` / `planLeadMergeCluster` — pure mirrors of SQL planning
- `invokeLeadMergeDryRun` / `invokeLeadMergeExecute` — thin RPC clients (ops/scripts; no Office UI in Fase 3)

## Out of scope

- Phone↔email transitive merge
- Hard-delete losers
- Office admin merge UI
- Auto-run all orgs on migrate
