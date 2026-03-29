# Job openings (domain)

Modal lowongan, link rekrutmen, skeleton loading, dan **hooks** (tipe + API Supabase).

## Struktur

```
job-openings/
├── index.ts              # Re-export components + hooks
├── components/           # UI: modal, tab, skeleton
│   ├── JobOpeningModal.tsx
│   ├── JobOpeningBasicInfoTab.tsx
│   ├── JobOpeningDetailsTab.tsx
│   ├── GenerateLinkModal.tsx
│   ├── BenefitsManager.tsx
│   └── JobOpenings*Skeleton.tsx
└── hooks/                # Types, CRUD, recruitment links, skills
    ├── jobOpeningTypes.ts
    ├── useJobOpeningsCrud.ts
    ├── optimizedRecruitmentLinkUtils.ts
    └── …
```

**Impor disarankan:** `import { JobOpeningModal, GenerateLinkModal } from '@/2-2-recruitment-dashboard/job-openings'` dan `.../job-openings/hooks/...` untuk tipe/util.

Halaman utama lowongan ada di `dashboard/JobOpeningsPage.tsx` (bukan di folder ini).
