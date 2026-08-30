# Manual QA: Kitchen Fire on Pay (per Sales Type)

Run after deploying migration `20260930669000_pos_kitchen_fire_policy.sql`.

## Preconditions

- Outlet with KDS enabled and at least one catalog product.
- Default fire policy: Dine In = Save Bill; Takeaway/Delivery/Pickup = On Pay.
- Optional: change policy under **KDS Settings → Transition Times** and confirm cashier picks up new policy on next pay/save (via `loadKitchenFirePolicy`).

## Matrix

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 1 | Walk-in pay-first (Dine In) | Add items → **Bayar** (no Save Bill) | KDS ticket **OPEN**; **not** auto-done after pay |
| 2 | Dine In save bill | Walk-in → **Simpan Bill** | KDS ticket **OPEN** immediately |
| 3 | Save + delta | Save bill → add 1 item → save again | Second KDS ticket with **delta lines only** (1 item) |
| 4 | Save then pay (pay-at-table) | Save bill → **Bayar** full cart | No duplicate full ticket; KDS may **auto-done** on pay |
| 5 | Takeaway on pay | Sales type Takeaway → pay without save | KDS fires **only on pay** |
| 6 | QRIS pay-first | Walk-in Takeaway → QRIS pay | Same as cash: KDS on pay, not auto-done |
| 7 | Split / portion pay | Open bill → split pay one line | KDS fires **paid lines only** |
| 8 | Policy override | Set Takeaway → Save Bill in KDS settings → save takeaway bill | KDS fires on save per new policy |

## SQL verification

```bash
# Column + defaults
psql ... -f scripts/qa/verify-pos-kitchen-fire-policy.sql
```

## Regression checks

- Bluetooth order ticket print still follows `printTicketOnPay` (independent of KDS fire policy).
- Refund/void still uses existing `voidKitchenTicketsForSession` / `applyKitchenTicketLineVoid`.
