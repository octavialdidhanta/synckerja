# Applications module

## Peran
Komponen untuk halaman lamaran & kandidat di Recruitment (`/recruitment/applications`) dan rute publik (apply, preview, profil kandidat).

## Struktur direktori

```
applications/
├── index.ts                 # Re-export dashboard + hooks
├── hooks/                   # useJobApplications, dll.
├── dashboard/               # UI HR: daftar, filter, quick view
│   ├── ApplicationsPage.tsx
│   ├── ApplicationsFilters.tsx
│   ├── ApplicationsTable.tsx
│   ├── ApplicationsOverview.tsx
│   ├── ApplicationsMetricsCards.tsx
│   ├── CandidatesTable.tsx
│   ├── CandidateQuickViewModal.tsx
│   └── CandidateActionsDropdown.tsx
├── public/                  # Rute publik (lazy-loaded dari App.tsx)
│   ├── JobApplication.tsx
│   ├── JobPreview.tsx
│   ├── ApplicationForm.tsx
│   ├── JobApplicationSkillsInput.tsx
│   ├── ApplicationThankYou.tsx
│   ├── CandidateProfile.tsx
│   └── CandidateProfileThankYou.tsx
└── candidate-form/          # Wizard/tabs profil kandidat + layanan form
    ├── index.ts
    ├── services/
    └── utils/
```

- **`dashboard/`** — dipakai lewat `ApplicationsPageWrapper` dan export di `index.ts`.
- **`public/`** — halaman apply/preview/thank-you; impor dari `@/2-2-recruitment-dashboard/applications/public/...`.
- **`candidate-form/`** — form multi-tab, tes, review; impor barrel: `@/2-2-recruitment-dashboard/applications/candidate-form`.

## Impor umum

```tsx
import { ApplicationsPage } from '@/2-2-recruitment-dashboard/applications/dashboard/ApplicationsPage';
import { useJobApplications } from '@/2-2-recruitment-dashboard/applications/hooks/useJobApplications';
import { CandidateProfileTabs } from '@/2-2-recruitment-dashboard/applications/candidate-form';
```

## Integrasi
- `src/App.tsx` — lazy route ke file di `public/`.
- `dashboard/ApplicationsPageWrapper.tsx` — `ApplicationsPage` + hook.
