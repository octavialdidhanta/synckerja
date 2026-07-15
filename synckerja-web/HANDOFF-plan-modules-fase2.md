# Handoff: Plan Modul per Plan (CMS → Office Fase 2)

**Dari:** synckerja-web (CMS admin)  
**Tanggal:** 2026-07-13  
**Status DB shared:** Sudah apply  
**Status office:** Belum implement gate mandiri

---

## Konteks singkat

CMS `/admin/pricing` sekarang bisa:
- **Buat plan baru** (slug, harga, trial, diskon)
- **Atur modul per plan** untuk tenant **mandiri** (`subscription_self_service_enabled = true`)

Data disimpan di:
- `subscription_plans` — plan + `features` jsonb (auto-generate dari modul aktif + harga)
- `subscription_plan_module_access` — `(subscription_plan_id, module_key, is_enabled)`

Tenant **Sales** tidak terpengaruh — tetap pakai `organization_sales_module_access` per org (sudah live).

**Penting:** Sampai fase 2 selesai, tenant mandiri di office masih **full access** semua modul. Konfigurasi CMS belum di-enforce.

---

## File yang sudah disalin ke repo office

### Migration (`supabase/migrations/` + mirror `synckerja-web/`)

| File | Status DB | Catatan |
|------|-----------|---------|
| `20260709182000_cms_plan_price_adjustments.sql` | Sudah apply | Audit harga plan/add-on CMS |
| `20260709182100_admin_plan_pricing_rpc.sql` | Sudah apply | RPC edit harga plan CMS |
| `20260713100000_subscription_plan_module_access.sql` | Sudah apply | **Baru** — modul per plan |

### Changelog

- `docs/synckerja-web` — entry `[2026-07-13]`

---

## Kebijakan product (jangan diubah tanpa koordinasi)

| Aspek | Keputusan |
|-------|-----------|
| Scope gate | **Mandiri only** — sales tetap `organization_sales_module_access` |
| Retroaktif | Hanya org **baru subscribe** / **ganti plan** ke depan |
| Dashboard | Selalu aktif |
| Subscription (mandiri) | Selalu aktif — tidak di-toggle CMS |
| Module keys | Harus match `sales_module_catalog_keys()` di SQL |

Module keys (8 toggle di CMS):
`okr`, `humanResources`, `finance`, `digitalMarketing`, `omnichannel`, `operations`, `tools`, `requestForm`

---

## Tugas fase 2 — tim office

### 1. Sync migration history (no re-apply jika DB shared sudah apply)

Copy file di atas sudah ada di `supabase/migrations/`. **Jangan apply ulang** ke Supabase shared jika objek sudah ada — cukup commit untuk history repo selaras.

Verifikasi:

```sql
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'subscription_plan_module_access'
) AS ok;
```

### 2. Hook baru: `usePlanModuleAccess`

**Lokasi disarankan:** `src/shared/auth/hooks/usePlanModuleAccess.ts`

**Logic:**
1. Deteksi tenant mandiri (`subscription_self_service_enabled = true` pada org)
2. Ambil `subscription_plan_id` dari `organization_subscriptions` org aktif
3. Baca `subscription_plan_module_access` WHERE `subscription_plan_id = ?`
4. Return `Record<ModuleKey, boolean>` — dashboard & subscription selalu `true`
5. Jika tidak ada baris / plan tidak ditemukan → fallback aman (semua modul aktif ATAU semua nonaktif — koordinasi product; rekomendasi: semua aktif agar tidak break existing mandiri)

**Referensi pola existing (sales):**
- `src/shared/auth/hooks/useSalesModuleAccess.ts`
- `src/shared/auth/module-access/moduleCatalog.ts`

### 3. Gate mandiri di routing / sidebar

Update (minimal):
- `src/shared/auth/hooks/useDepartmentAccess.ts` — untuk mandiri, gabungkan `usePlanModuleAccess` bukan allow-all
- `AppSidebar` — ikon kunci + upsell untuk modul nonaktif (mirror sales tenant UX)

**Sales tenant:** jangan ubah path — tetap `useSalesModuleAccess`.

### 4. Apply modul saat subscribe / ganti plan

Saat org mandiri:
- Subscribe plan baru → modul efektif = modul plan tersebut
- Ganti plan → modul efektif = plan baru (tidak retroaktif ke subscriber lama yang tidak ganti plan)

Implementasi bisa:
- Read langsung dari `subscription_plan_module_access` via join (tanpa copy ke tabel org) — **rekomendasi**
- ATAU RPC office saat change plan (jika perlu cache per org)

### 5. Test plan

| Skenario | Expected |
|----------|----------|
| Plan A: hanya HR + Finance aktif | Route HR/Finance OK; route lain upsell |
| Tenant sales | Tidak berubah — tetap CMS per-org modules |
| Dashboard | Selalu accessible |
| Mandiri tanpa subscription | Graceful fallback |
| Plan inactive dengan subscriber | Office tetap baca plan via FK |

---

## SQL referensi

```sql
-- Modul satu plan (authenticated SELECT via RLS)
SELECT module_key, is_enabled
FROM public.subscription_plan_module_access
WHERE subscription_plan_id = '<plan_id>';

-- Plan + jumlah modul aktif (CMS admin RPC)
SELECT * FROM public.admin_list_subscription_plans();
```

---

## Risiko & mitigasi

| Risiko | Mitigasi |
|--------|----------|
| Module keys desync web ↔ office ↔ SQL | Single source: `sales_module_catalog_keys()` |
| Mandiri existing full access | Dokumentasi + rollout bertahap |
| Subscriber plan di-nonaktifkan | Office tetap baca plan inactive via FK |

---

## Kontak / pertanyaan

Balas di channel tim dengan:
- Branch PR office fase 2
- Screenshot test upsell mandiri
- Konfirmasi tidak ada regresi sales tenant
