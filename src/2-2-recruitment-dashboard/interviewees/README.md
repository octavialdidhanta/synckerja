# Interviewees

Halaman `/recruitment/interviewees` dan profil kandidat (route HR).

## Struktur

```
interviewees/
├── index.ts
├── IntervieweesPage.tsx
├── IntervieweeTab.tsx
├── CandidateProfile.tsx
├── IntervieweeActionsDropdown.tsx
├── …
├── components/           # Filters, tabel, overview, footer (bukan "section")
│   ├── IntervieweesFilters.tsx
│   ├── IntervieweesTable.tsx
│   └── …
├── services/
├── utils/
└── README.md
```

Header/tab bersama diimpor dari `@/2-2-recruitment-dashboard/dashboard/components` (`HeaderAndTab`).
