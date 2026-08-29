# Sales Types (Library)

Sales types control how catalog prices, taxes, and gratuities apply at checkout.

## Relationships

```text
catalog_sales_types
  ├── catalog_sales_type_outlets   (which outlets use this sales type)
  └── catalog_sales_type_gratuities (which gratuities apply for this sales type)

catalog_gratuities
  └── catalog_gratuity_outlets       (which outlets expose each gratuity)
```

At checkout, a gratuity is applied only when **all** of the following are true:

1. Org checkout setting `gratuity_enabled` is on
2. The gratuity is active and assigned to the checkout outlet
3. The gratuity is linked to the selected sales type

Runtime filter: `filterGratuitiesForOutletAndSalesType` in
`src/8-2-1-default-prices/checkout/lib/computeCatalogCheckoutTotals.ts`.

## Assign Service Fee to Dine in

1. Open **Operations → Library → Gratuity** and confirm **Service Fee** is active for the target outlet.
2. Open **Operations → Library → Sales Types**.
3. Edit **Dine in**.
4. Ensure the outlet is checked under **Assigned Outlets**.
5. Check **Service Fee** under **Assign gratuity**.
6. Save.

The sales type list shows a warning when gratuity is enabled org-wide but a sales type has no gratuity links.

## Checkout and reporting impact

- **POS / Customer Visits:** bill panel shows gratuity lines from linked catalog rules.
- **Persistence:** `createStoreCheckoutSalesActivity` writes exact rows to
  `sales_activity_checkout_gratuities` with `is_backfill_estimate = false`.
- **Gratuity Sales report:** new checkouts appear under the correct name/rate group and reconcile with Sales Summary gratuity.

## Historical data note

Checkouts recorded before a sales type ↔ gratuity link existed may remain under
**Unknown / Legacy** in the Gratuity Sales report (`is_backfill_estimate = true`).
Totals still reconcile; only the breakdown label is approximate.

## QA verification

Use `scripts/qa/verify-gratuity-sales-checkout.sql` after linking and after a new POS checkout.
