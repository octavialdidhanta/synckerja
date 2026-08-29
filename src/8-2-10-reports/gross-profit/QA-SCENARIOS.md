# Gross Profit Report — QA Scenarios

Manual checklist for `/operations/reports/sales/gross-profit`.

Each scenario: **Setup → Steps → Expected**

---

## GP-01 — URL outlet empty / all

**Setup:** Org with 2+ outlets and sales in both.

**Steps:**
1. Open `/operations/reports/sales/gross-profit?outlet`
2. Open `/operations/reports/sales/gross-profit?outlet=all`

**Expected:**
- Outlet filter shows **All Outlets**
- Data includes transactions from all outlets (RPC `p_outlet_id = null`)

---

## GP-02 — Single outlet filter

**Setup:** Known outlet UUID with sales.

**Steps:**
1. Open `/operations/reports/sales/gross-profit?outlet={outlet_uuid}`
2. Compare totals with Sales Summary for same outlet + period

**Expected:**
- Only that outlet's data
- URL preserves outlet when changing date preset

---

## GP-03 — Align with Sales Summary

**Setup:** Same outlet + date range on both pages.

**Steps:**
1. Open Sales Summary → note Gross Sales, Discounts, Net Sales, Refunds
2. Open Gross Profit with same filters

**Expected:**
- Gross Sales, Discounts, Net Sales, Refunds **match** Sales Summary exactly

---

## GP-04 — Gross Profit formula

**Setup:** Any period with net sales and COGS.

**Steps:**
1. Read Net Sales, COGS, Gross Profit, Margin % from summary table

**Expected:**
- `Gross Profit = Net Sales − COGS`
- `Margin % = (Gross Profit / Net Sales) × 100` (0% if Net = 0)

---

## GP-05 — Product with COGS at checkout

**Setup:** Product with `track_cogs` or recipe BOM; new checkout after snapshot feature.

**Steps:**
1. Pay one unit at POS
2. Open Gross Profit for today + outlet

**Expected:**
- COGS > 0 for that product in items table
- `cogsIncomplete` false if all lines have COGS

---

## GP-06 — Product without COGS

**Setup:** Product sold without HPP/recipe link.

**Steps:**
1. Sell product without COGS data
2. Open Gross Profit

**Expected:**
- Amber incomplete callout visible
- Item row shows **Incomplete** badge

---

## GP-07 — Backfill estimated COGS

**Setup:** Legacy lines with `unit_cogs` null but catalog linked.

**Steps:**
1. Open Gross Profit with incomplete callout
2. Click **Fill estimated COGS for old sales**
3. Wait for toast

**Expected:**
- Toast shows `updated_count > 0` (if estimatable lines exist)
- Report refreshes; incomplete count decreases

---

## GP-08 — Full refund same period

**Setup:** Checkout then full refund in same date range.

**Steps:**
1. Note Net / COGS / GP before refund
2. Refund from Activity
3. Refresh Gross Profit

**Expected:**
- Net Sales and COGS **decrease** (sale excluded)
- Refunds row shows refund amount (by refund date)
- Gross Profit = Net − COGS (refunds not subtracted again)

---

## GP-09 — Refund cross-period

**Setup:** Sale in month A, refund in month B.

**Steps:**
1. Gross Profit for month A → sale included
2. Gross Profit for month B → Refunds row shows amount; sale not in Net

**Expected:**
- No double-count: refunded sale never in Net/COGS after refund
- Refunds informational in refund month only

---

## GP-10 — Custom amount / non-product lines

**Setup:** Bill with custom amount or non-product line + products.

**Steps:**
1. Open Gross Profit
2. Compare summary Net Sales vs sum of items net (or read product-only footnote)

**Expected:**
- Summary Net Sales ≥ sum of product items net
- When non-product net > 0: **Non-product / custom revenue** row appears in waterfall after Net Sales
- Items table footer shows **Total (products)**, non-product line, and green reconciliation message when product + non-product = summary Net Sales

---

## GP-13 — Waterfall % pills (Moka-style)

**Setup:** Period with net sales > 0 and COGS > 0 (if available).

**Steps:**
1. Open Gross Profit summary table
2. Check Net Sales, COGS, and Gross Profit rows

**Expected:**
- Net Sales shows **100%** pill
- COGS shows **% of Net Sales** pill (amber)
- Gross Profit shows **margin %** pill (green)
- Refunds row styled as deduction (parentheses) like Sales Summary

---

## GP-11 — Category filter, search, export

**Setup:** Multiple categories and products.

**Steps:**
1. Select a category filter
2. Type search on product name
3. Export XLSX

**Expected:**
- Table shows filtered rows only
- Export Items sheet matches search + category (not limited to top 50)
- Summary sheet includes refunds note row

---

## GP-12 — Filter change without full skeleton

**Setup:** Gross Profit loaded with data.

**Steps:**
1. Change date preset (e.g. This Month → Last Month)
2. Observe loading behavior

**Expected:**
- Previous numbers stay visible while fetching (`keepPreviousData`)
- No full-page skeleton flash on filter change

---

## Quick regression checklist

- [ ] GP-01 All outlets URL
- [ ] GP-03 Matches Sales Summary
- [ ] GP-04 Formula
- [ ] GP-08 Refund same period
- [ ] GP-10 Non-product row + items footer reconciliation
- [ ] GP-13 Waterfall % pills
- [ ] GP-12 No skeleton flash
