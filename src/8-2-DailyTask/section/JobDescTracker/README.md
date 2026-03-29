# Job Desc Tracker

Sidebar tab for `/tools/daily-task` that mirrors the "Funnel" experience from the Social Media dashboard.  
It focuses on revealing who is busy versus idle by aggregating assignments from Supabase tables:

- `daily_tasks_assigned`
- `task_steps_assigned`
- `task_steps_to_steps_assigned`

## Directory Structure

```
JobDescTracker/
├── JobDescTracker.tsx          # Main sidebar container with tabs + metrics
├── JobDescFilters.tsx          # Shared filter controls (timeframe, employee, etc.)
├── JobDescEmployeeCard.tsx     # Compact view per employee with pending info
├── useJobDescAssignments.ts    # React Query hook to fetch & aggregate data
├── types.ts                    # Shared types and enums
├── index.ts                    # Barrel exports
└── README.md
```

## Integration Points

- Imported inside `DailyTaskPage` as the third sidebar tab (“Job Desc”).
- Relies on `useCurrentOrg` to scope queries and `@tanstack/react-query` for caching.
- All strings go through `useAppTranslation` so the tab responds to language switches.

## Usage

```tsx
import { JobDescTracker } from "@/8-2-DailyTask/section/JobDescTracker";

// Inside sidebar tab content
<JobDescTracker />
```

## Notes

- Default timeframe is the current calendar week (Mon–Sun) but users can switch to daily, monthly, or custom date ranges.
- Pending duration is calculated from `assigned_at`, matching the business requirement to see how long work has been waiting.
- `seamless-scroll` and `max-h-[calc(100vh-120px)]` classes keep scroll behaviour consistent with other sidebar tabs.


