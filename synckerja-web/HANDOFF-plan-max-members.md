# Handoff: Max Members per Plan (CMS → Office)

**Dari:** synckerja-web (CMS admin)  
**Tanggal:** 2026-07-14  
**Migration:** `20260714100000_subscription_plans_max_members.sql`  
**Status DB shared:** Sudah apply (manual SQL Editor)

---

## Ringkasan

Kolom baru `subscription_plans.max_members` menyimpan **cap seat per plan** secara terstruktur. CMS `/admin/pricing` bisa mengatur field ini saat create/edit plan.

`features` jsonb tetap untuk **display** di UI plan office, sekarang di-generate dengan baris `"N Member Allowed"` dari kolom `max_members`.

**Grandfather:** Menurunkan `max_members` di CMS tidak memaksa subscriber lama turun seat. Cap baru berlaku untuk org baru subscribe / ganti plan ke depan.

**Hasil backfill (verifikasi):**

| Plan | max_members | features (awal) |
|------|-------------|-----------------|
| Start Up Plan | 1 | `"1 Member Allowed"`, harga, dashboard... |
| Scale Up Plan | 1 | `"1 Member Allowed"`, harga, dashboard... |

> Jika Scale Up seharusnya cap 100, admin ubah lewat CMS Edit → tab Harga → Max member.

---

## File di folder `synckerja-web/` (handoff)

| File | Isi |
|------|-----|
| `20260714100000_subscription_plans_max_members.sql` | Migration (sudah apply — jangan re-apply) |
| `synckerja-web` | Changelog lengkap CMS → office |
| `HANDOFF-plan-max-members.md` | Dokumen ini |
| `PROMPT-handoff-max-members.md` | Prompt copy-paste untuk tim |

---

## Perubahan office (WAJIB deploy)

| File | Perubahan |
|------|-----------|
| `src/0-onboarding/types/subscriptionPlan.ts` | `max_members` |
| `src/0-onboarding/utils/subscriptionPlanUtils.ts` | `getPlanMaxMembers()` |
| `src/0-onboarding/hooks/useSubscriptionPlans.ts` | SELECT `max_members` |
| `src/10-subscription/types/SubscriptionPlanCatalog.ts` | `max_members` |
| `src/10-subscription/plans/useHRISSubscriptionPlansController.ts` | `resolvePlanMaxMembers()` |
| `src/10-subscription/plans/HRISSubscriptionPlansTab.tsx` | Pakai `resolvePlanMaxMembers` |

Logic: `getPlanMaxMembers(plan)` → prefer `plan.max_members`, fallback parse `features`.

**Juga commit** migration ke `supabase/migrations/` (history repo selaras, DB sudah apply).

---

## Verifikasi DB

```sql
SELECT name, max_members, features FROM public.subscription_plans ORDER BY name;
```

---

## Test setelah deploy office

| Skenario | Expected |
|----------|----------|
| Start Up Plan | Slider max = 1 |
| Plan berbayar (max_members=100) | Slider max = 100 |
| Org existing seat > cap baru | Tetap jalan (grandfather) |
| Onboarding trial | Slider max dari `max_members` |

---

## Kontak

Balas dengan: migration sudah di-commit + smoke test `/subscription/plans` + onboarding slider.
