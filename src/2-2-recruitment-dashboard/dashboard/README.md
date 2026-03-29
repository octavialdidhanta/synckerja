# Recruitment shell (dashboard routes)

Halaman bertab untuk area `/recruitment/*`: overview, lowongan, lamaran — memakai header/tab bersama.

## Struktur

```
dashboard/
├── index.ts
├── DashboardOverview.tsx
├── JobOpeningsPage.tsx
├── ApplicationsPageWrapper.tsx
├── components/           # UI bersama (HeaderAndTab, tabel/filters job openings, …)
│   ├── HeaderAndTab.tsx
│   ├── JobOpeningsFilters.tsx
│   ├── JobOpeningsTable.tsx
│   └── …
└── utils/
    └── jobOpeningsUtils.ts
```

Impor dari luar: `@/2-2-recruitment-dashboard/dashboard/...` atau `@/2-2-recruitment-dashboard/dashboard/components`.
