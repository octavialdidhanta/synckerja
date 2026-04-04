# Audit Bug: Halaman /digital-marketing/social-media/dashboard

**Tanggal audit terakhir:** 2026-02-12  
**Scope:** `src/6-1-dashboard` dan dependensi langsung untuk route dashboard.

---

## Progress dari audit sebelumnya

Perbaikan yang **sudah diterapkan** dari hasil audit sebelumnya:

| # | Item (audit lama) | Status | Bukti di kode |
|---|-------------------|--------|----------------|
| 1 | Review token: feedback saat RPC gagal | **SELESAI** | `pages/SocialMediaDashboardPage.tsx`: pada `error`/`!data` ada `toast.error('Invalid or expired review link')` dan clear param (L224–232). |
| 2 | all-social-media-links: scope per org | **SELESAI** | Query pakai `queryKey: ['all-social-media-links', organizationId]` dan `enabled: !!organizationId`. Tabel tidak punya kolom `organization_id`; RLS membatasi via join. |
| 3 | Batch production update tanpa catch | **TIDAK PERLU** | `updateContentPlan` pakai `mutate()`; error sudah ditangani di `onError` mutation (`useOptimizedSocialMediaMutations`) dengan toast. |
| 4 | Preloader prefetch error tidak dilaporkan | **SELESAI** | `DashboardDataPreloader.tsx`: di `.catch()` ada `toast.error('Failed to load dashboard data. Refresh the page to retry.')` dan tetap `setReady(true)`. |
| 5 | Error query tanpa fallback UI | **SELESAI** | Dashboard menampilkan banner error (`dataError`) dan tombol "Retry" yang memanggil `refreshAll()` (L1112–1122). |
| 6 | handleUnapproval hanya log (di page) | **SELESAI** | Di `pages/SocialMediaDashboardPage.tsx` kedua pemanggil `handleUnapproval` punya `toast.error('Failed to remove approval task')` (L806–808, L821–823). |
| 7 | syncAllExistingPlans error hanya log | **SELESAI** | Ada `toast.warning('Background sync failed. Refresh the page to retry.')` (L282). |
| 8 | editingManager `useState<any>` | **SELESAI** | Diganti ke `useState<{ id: string; name: string } \| null>(null)` (L155). |
| 10 | checkApprovalAccess promise tanpa catch | **SELESAI** | `GoogleDriveLinkDialog.tsx`: `.then(setCanShowApprovalButtons).catch(() => setCanShowApprovalButtons(false))` (L274). |
| 12 | Error data tidak ditampilkan di UI | **SELESAI** | `dataError` dari `useSocialMediaData()` dipakai; banner merah + Retry ditampilkan saat error. |

**Ringkas:** Semua item High/Medium yang tersisa telah diperbaiki (lihat implementasi terbaru di bawah).

---

## Implementasi terbaru (sesuai audit)

- **M1** — **SELESAI:** `ContentPlanTable.tsx`: tambah `toast.error('Failed to remove approval task')` di `.catch()` handleUnapproval.
- **M2** — **SELESAI:** `useOptimizedSocialMediaMutations.ts`: hapus `(supabase as any)`; pakai `safeUpdates as Record<string, unknown>` / `cleanPlanData as Record<string, unknown>`; ganti `console.log`/`console.error` dengan `devLog.debug`/`devLog.error`.
- **M3** — **SELESAI:** `ContentPlanRow.tsx`: pada early return di `maybeOpenBrandingPlanCreate` dan `recheckOrRollbackAfterCreateClose` tambah `devLog.debug('... missing plan data (service, post_date or organization_id)')`.
- **L1, L2, L3, L4, L5, L7, L8, L9** — **SELESAI:** Ganti `console.log`/`console.warn`/`console.error` dengan `devLog.debug`/`devLog.warn`/`devLog.error` di: pages/SocialMediaDashboardPage.tsx, GoogleDriveLinkDialog, ContentPlanTable, useContentPillarData, context/SocialMediaContext.tsx, useApprovalTaskStepCreation, PublicContentReviewPage, useOptimizedSocialMediaMutations, ContentPlanRow (onRevision).
- **L6** — Tidak diubah (urutan effect sudah aman).
- **L10** — Belum diubah (TitleDialog; bisa dilakukan nanti).

---

## 1. Daftar bug & temuan (terkini)

### High priority

| # | File:Line | Deskripsi | Prioritas | Saran perbaikan |
|---|-----------|-----------|-----------|------------------|
| - | - | *(Tidak ada item High tersisa; semua sudah diperbaiki.)* | - | - |

### Medium priority

| # | File:Line | Deskripsi | Prioritas | Status |
|---|-----------|-----------|-----------|--------|
| M1 | ContentPlanTable.tsx | handleUnapproval catch tanpa toast | Medium | **SELESAI** — toast ditambah. |
| M2 | useOptimizedSocialMediaMutations.ts | (supabase as any) | Medium | **SELESAI** — cast dihapus, pakai assertion pada payload. |
| M3 | ContentPlanRow.tsx | Early return tanpa feedback | Medium | **SELESAI** — devLog.debug ditambah. |

### Low priority

| # | File:Line | Deskripsi | Prioritas | Status |
|---|-----------|-----------|-----------|--------|
| L1–L5, L7–L9 | Berbagai file | console.log/warn di production | Low | **SELESAI** — diganti devLog. |
| L6 | pages/SocialMediaDashboardPage.tsx | Effect tab vs ?review= | Low | Tidak diubah (aman). |
| L10 | TitleDialog.tsx | console.log/warn duplicate & deadline | Low | **Belum** — opsional. |

### Code smells / logic risks

| # | File:Line | Deskripsi | Prioritas | Saran perbaikan |
|---|-----------|-----------|-----------|------------------|
| C1 | **pages/SocialMediaDashboardPage.tsx:501-506** | `calculateOnTimeStatusForPlan`: jika `hasLinks` true pakai "hari ini" sebagai actual post date; bisa tidak akurat untuk post lama. | Low | Dokumentasikan atau pakai nilai dari backend/plan jika ada. |
| C2 | **pages/SocialMediaDashboardPage.tsx:257-279** | Sync effect: pada unmount sebelum timeout hanya `clearTimeout`; ref tidak di-reset. | Low | Secara umum aman; jika ingin retry on remount bisa reset `hasSyncedRef.current = false` di cleanup. |
| C3 | **ContentPlanRow.tsx** | Banyak akses `(plan as any)` untuk property yang tidak ada di type. | Low | Perluas type `ContentPlan` (atau interface row) dengan field yang dipakai (e.g. `organization_id`). |
| C4 | **dashboardQueryOptions.ts** | Employees query memakai `// @ts-expect-error` untuk bypass inferensi "excessively deep". | Low | Pertahankan sementara; alternatif: fetch tanpa nested relation atau query terpisah. |

---

## 2. Ringkasan error handling & API (status terkini)

- **Sudah ditangani:** Review token (toast + clear URL on error), prefetch (toast on catch), handleUnapproval di page (toast), syncAllExistingPlans (toast), checkApprovalAccess (catch), error data dashboard (banner + Retry). Mutation update/insert/delete punya onError + toast.
- **Konsisten:** ContentPlanTable sekarang juga menampilkan toast saat handleUnapproval gagal.
- **API fallback:** all-social-media-links tetap return `[]` on error (cukup aman); query options tetap throw error untuk React Query retry; UI error ditampilkan via banner + Retry.

---

## 3. Rekomendasi prioritas perbaikan

1. **Selesai:** Semua item Medium dan sebagian besar Low (console → devLog) sudah diimplementasikan.
2. **Opsional:** L10 (TitleDialog console.*); dokumentasi/penyesuaian logic actualPostDate (C1) dan sync ref (C2) jika perlu.
3. **Code smells:** C3 (perluas type ContentPlan untuk kurangi `(plan as any)`); C4 (pertahankan @ts-expect-error di dashboardQueryOptions).

---

## 4. Apakah ada progress dari hasil audit sebelumnya?

**Ya.** Progress perbaikan dari audit sebelumnya:

- **High:** Semua 5 item High lama sudah ditangani (review token, all-social-media-links scope, preloader toast, error banner + Retry; batch update sengaja tidak diubah karena mutation onError sudah menangani).
- **Medium:** Semua 6 item Medium selesai (termasuk M1, M2, M3).
- **Low:** Sebagian besar selesai (L1–L9 diganti devLog); L10 (TitleDialog) opsional; L6 tidak diubah.

Dokumen ini menggantikan daftar bug lama dengan status “sudah diperbaiki” dan daftar sisa + low/code smells yang lihat implementasi di atas.
