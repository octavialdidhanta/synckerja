# Stock Commit Point

Per-outlet policy for **when** POS catalog stock moves: `pay` | `kitchen` | `fulfillment`.

## Modes (layman)

| Mode | When stock moves |
|------|------------------|
| **pay** | On successful checkout (Customer Visit + POS retail default) |
| **kitchen** | Recipe ingredients on Save Bill / kitchen print; pay only deducts uncommitted recipe qty and FG (`finished_goods_only`) |
| **fulfillment** | Reserve on Save Bill; deduct FG on Ship; pay does not deduct catalog FG |

## Residual hardening (R1–R3)

- **R1 Void:** Reverse uses `pos_session_stock_commits.line_index` → stable `L{n}` (not re-index of a single line).
- **R2 Refund:** `reverse_store_checkout_stock` + full kitchen reverse when session is kitchen mode; requires `sales_activity_id`. Income/bank not reversed in V1.
- **R3 Hybrid:** Kitchen commits only products with a base recipe; pay annotates `stock_scope` so trackStock+recipe does not double-consume ingredients.
- **Fulfillment:** Skip reserve if session already has `pos_fulfillment` movements; cancel releases remaining reserve only (does not reverse ship).

## Key folders

```
lib/pay/       computePayStockDelta, annotatePayStockScopes, reversePaidCheckoutStock
lib/kitchen/   filterKitchenCommitLines
lib/void/      resolveVoidReverseLine
lib/reserve/   computeReserveDelta, releaseFulfillmentReserve, sessionAlreadyFulfilled
lib/recipe/    fetchProductIdsWithBaseRecipe
```

## Migrations

- `20260930600000` schema + settings
- `20260930601000` kitchen / fulfillment / reserve RPCs
- `20260930602000` multi-batch reverse + reserve ledger
- `20260930603000` checkout per-line `stock_scope` + idempotency per activity+line_key

Customer Visit checkout stays **pay-only** (`stock_scope` default `full`).
