# Prompt handoff — Max Members per Plan (copy-paste ke tim office)

---

## Versi lengkap

```
Handoff CMS → Office: Max Members per Plan

Halo tim synckerja office,

Dari synckerja-web (CMS) ada update DB shared yang perlu deploy kode office.

=== KONTEKS ===
• Kolom baru: subscription_plans.max_members (integer, cap seat per plan)
• CMS /admin/pricing: field "Max member" saat create/edit plan
• features jsonb di-regenerate: "N Member Allowed" → harga → modul → dashboard
• Batas member TIDAK lagi hanya parse string di features

=== STATUS DB ===
✅ Migration 20260714100000_subscription_plans_max_members.sql SUDAH APPLY (SQL Editor)
✅ Backfill selesai — contoh:
   - Start Up Plan: max_members = 1
   - Scale Up Plan: max_members = 1
⚠️ Jangan re-apply migration ke Supabase shared

Verifikasi:
SELECT name, max_members, features FROM public.subscription_plans ORDER BY name;

=== KEBIJAKAN ===
• Default plan berbayar (RPC): 100 jika tidak diisi
• Trial/gratis: default 1
• Grandfather: turunkan cap di CMS TIDAK memaksa subscriber lama turun seat
• Cap baru hanya untuk org baru subscribe / ganti plan ke depan

=== TUGAS TIM OFFICE ===

1. Commit migration ke supabase/migrations/ (history repo — DB sudah apply)
   File: 20260714100000_subscription_plans_max_members.sql
   (sudah ada di synckerja-web/ handoff folder)

2. Deploy perubahan kode (sudah disiapkan di repo office, review + merge):
   • src/0-onboarding/types/subscriptionPlan.ts — max_members
   • src/0-onboarding/utils/subscriptionPlanUtils.ts — getPlanMaxMembers()
   • src/0-onboarding/hooks/useSubscriptionPlans.ts — SELECT max_members
   • src/10-subscription/types/SubscriptionPlanCatalog.ts — max_members
   • src/10-subscription/plans/useHRISSubscriptionPlansController.ts — resolvePlanMaxMembers()
   • src/10-subscription/plans/HRISSubscriptionPlansTab.tsx — slider cap dari kolom

3. Smoke test:
   • /subscription/plans — slider max member sesuai max_members plan
   • Onboarding — cap seat dari kolom (bukan hardcode 100)
   • Org existing dengan seat > cap baru — tidak break (grandfather)

=== FILE HANDOFF ===
• synckerja-web/HANDOFF-plan-max-members.md
• synckerja-web/PROMPT-handoff-max-members.md (ini)
• synckerja-web/synckerja-web — changelog
• docs/synckerja-web — entry [2026-07-14]

=== CATATAN SCALE UP ===
Jika Scale Up Plan seharusnya cap 100 (bukan 1), admin CMS ubah lewat Edit → Harga → Max member.
Itu tidak retroaktif ke subscriber lama.

Balas dengan konfirmasi deploy + hasil smoke test.
Terima kasih.
```

---

## Versi singkat (chat internal)

```
@tim-office Handoff max_members per plan.

DB shared sudah apply (20260714100000). Kolom subscription_plans.max_members + features regenerate.
Jangan re-apply migration. Deploy office: getPlanMaxMembers + SELECT max_members + slider subscription plans.

File: synckerja-web/HANDOFF-plan-max-members.md
Test: /subscription/plans slider cap = max_members plan.
```
