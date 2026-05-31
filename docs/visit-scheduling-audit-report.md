# Visit Scheduling — Audit & Demo Report

**Terakhir diperbarui:** 2026-05-30 (post-audit P1–P4 implemented)  
**Flow audit lengkap:** [`visit-scheduling-flow-audit-2026-05-31.md`](./visit-scheduling-flow-audit-2026-05-31.md)
**Org demo:** `663c9336-8cb6-4a36-9ad9-313126e70a1a` (Synckerja)  
**Karyawan uji:** OCTA `001b6725-bf16-4a2f-81ae-8960cf86c46d`  
**Demo client:** `VS Fresh Demo — PT Maju Bersama` (`c1c1c1c1-1111-4111-8111-111111111101`)

---

## Ringkasan eksekutif (post-fix)

| Area | Status |
|------|--------|
| **Database + RPC** | **OK** — kolom eksekusi visit + `validate_client_visit_location` |
| **Desktop jadwal + client-visits** | **OK** — shared embed, wizard → `scheduleVisitFromWizard` |
| **Mobile start/end** | **OK** — UPDATE scheduled → `ongoing` → `completed` |
| **Mobile route jadwal-kunjungan** | **OK** — redirect ke client-visits |
| **Activities (sales_activities)** | **Terpisah** — FK ditunda; demo row ada |
| **Settings Visit Scheduling** | **Redirect** — card ke jadwal-kunjungan (mock dihapus) |
| **Mobile notifications UX** | **OK** — Assigned Client Sites; hide ongoing/completed today |
| **Mobile period fetch** | **OK** — `useClientVisitData` by date range |
| **Verify otomatis** | **11/11 PASS** — `npm run verify:visit-scheduling` |

---

## Post-audit cleanup (P1–P4, 2026-05-30)

| Item | Status |
|------|--------|
| Settings redirect card | ✅ `VisitScheduling.tsx` |
| Notifications rename + hide | ✅ `VisitNotifications.tsx` + `visitLocationDisplay.ts` |
| Mobile period fetch | ✅ `useClientVisitData(dateRange)` |
| Dead code removed | ✅ List/Form/LocationVisitScheduler/stale TodayVisitSchedule |

## Cara re-run demo & verify

```bash
npm run verify:visit-scheduling
npm test -- src/shared/lib/sales/scheduleVisitFromWizard.test.ts
```

---

## Perubahan implementasi (P0–P2)

### P0 — Database

- [`20260601120000_client_visits_execution_columns.sql`](../supabase/migrations/20260601120000_client_visits_execution_columns.sql) — `actual_*`, foto, lokasi jsonb, validasi
- [`20260601120100_validate_client_visit_location_rpc.sql`](../supabase/migrations/20260601120100_validate_client_visit_location_rpc.sql) — nearest client-site dalam radius

### P1 — Desktop + hooks

- [`scheduleVisitFromWizard.ts`](../src/shared/lib/sales/scheduleVisitFromWizard.ts) — parse wizard → office location + visit
- [`VisitSchedulingPageContent.tsx`](../src/5-2-jadwal-kunjungan/components/VisitSchedulingPageContent.tsx) — `scheduleVisitFromWizard` (bukan `addLocation` saja)
- [`sales.ts`](../src/shared/hooks/organized/sales.ts) — fix `useClients` (`organization_id`), invalidate query lintas tab, embed `useClientVisits`

### P1 — Mobile

- [`ClientVisit.tsx`](../android-mobile/1-client-visit/pages/ClientVisit.tsx) — status `ongoing`; UPDATE scheduled row on start
- [`useClientVisitData.ts`](../android-mobile/1-client-visit/hooks/useClientVisitData.ts) — date-range fetch + today subset for active visit
- [`VisitNotifications.tsx`](../android-mobile/1-client-visit/components/VisitNotifications.tsx) — Assigned Client Sites + hide ongoing/completed today

### P2 — UX

- [`SalesOperationsPage.tsx`](../src/5-2-activities/pages/SalesOperationsPage.tsx) — mobile jadwal → redirect client-visits
- Status UI: hapus `confirmed`; gunakan `scheduled | ongoing | completed | cancelled`
- [`VisitSchedulingTable.tsx`](../src/5-2-jadwal-kunjungan/components/VisitSchedulingTable.tsx) — `showPaymentActions={false}` default

---

## Hasil verify matrix (linked DB)

| Test | Deskripsi | Result |
|------|-----------|--------|
| V01–V03 | Demo seed + join | **PASS** |
| V04 | `in_progress` ditolak DB | **PASS** |
| V05 | Kolom mobile | **PASS** |
| V06 | createScheduledVisit | **PASS** |
| V07 | Shared table | **PASS** |
| V08 | RPC lokasi | **PASS** |
| V09 | Sales activity demo | **PASS** |
| V10 | Status vocabulary | **PASS** |
| V11 | scheduled → ongoing | **PASS** |

---

## QA manual yang disarankan

| # | Skenario | Expected |
|---|----------|----------|
| 1 | Desktop wizard New Visit | Row di jadwal + client-visits; lokasi `is_client_location=true` |
| 2 | Mobile TodayVisitSchedule | Visit OCTA hari ini tampil |
| 3 | Mobile Start visit onsite | Row scheduled → `ongoing` (tidak duplikat) |
| 4 | Mobile Complete | `completed` + optional sales activity modal |
| 5 | Mobile buka tab jadwal-kunjungan sales | Redirect ke client-visits |

---

## Di luar scope (tetap)

- FK `client_visits` ↔ `sales_activities`
- Payment modal di visit table (hidden sampai FK ada)
- Settings [`VisitScheduling.tsx`](../src/2-3-settings/components/VisitScheduling.tsx) — redirect card (mock removed)

---

## Kesimpulan

**Visit Scheduling terintegrasi desktop ↔ mobile siap untuk QA sign-off** setelah smoke manual di atas. Gate otomatis: **`npm run verify:visit-scheduling` → 11/11 PASS**.
