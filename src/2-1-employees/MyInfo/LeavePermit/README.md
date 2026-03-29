# Leave Permit Information Page Components

This directory contains ALL components, hooks, utilities, and types for the `/my-info/leave-permit?id={id}` page functionality.

## Complete Structure

```
LeavePermit/
├── pages/                          # Page components
│   └── EmployeeLeavePermit.tsx    # /my-info/leave-permit?id={id} page
├── components/                     # All components (19 files)
│   ├── index.ts
│   └── employee-detail/           # Employee detail components
│       ├── PersonalInfoTab.tsx    # Personal information tab
│       ├── PersonalInfoForm.tsx   # Personal information form
│       ├── ComprehensiveLeaveHistory # ⭐ Main: Leave history (external)
│       ├── EmploymentInfoTab.tsx  # Employment information tab
│       ├── EmployeePageLayout.tsx # Main page layout
│       ├── EmployeeDetailSidebar.tsx # Sidebar with employee info
│       ├── EmployeeLoadingState.tsx  # Loading state component
│       ├── EmployeeErrorBoundary.tsx # Error boundary component
│       ├── EducationInfoTab.tsx   # Education information tab
│       ├── InformalEducationInfoTab.tsx # Informal education tab
│       ├── WorkExperienceTab.tsx  # Work experience tab
│       ├── WorkExperienceInfoTab.tsx # Work experience info tab
│       ├── FamilyMembersTab.tsx   # Family members tab
│       ├── FamilyMembersInfoTab.tsx # Family members info tab
│       ├── FamilyInfoTab.tsx      # Family information tab
│       ├── DocumentsTab.tsx       # Documents tab
│       ├── DocumentsInfoTab.tsx   # Documents info tab
│       └── PayrollInfoTab.tsx     # Payroll information tab
├── hooks/                          # All hooks (16 files)
│   ├── index.ts                   # Hooks export
│   ├── useEmployeeDetail.ts       # Get employee details from Supabase
│   ├── useUpdateEmployee.ts       # Update employee data to Supabase
│   ├── useAutoSave.ts             # Auto-save functionality
│   ├── usePerformanceMonitor.ts   # Performance monitoring
│   ├── useEmployees.ts            # Employee types and interfaces
│   ├── useShowToast.ts            # Toast notifications
│   ├── useCurrentOrg.ts           # Get current organization
│   ├── useOptimizedCurrentOrg.ts  # Optimized org fetching
│   ├── useAvatarSync.ts           # Avatar synchronization
│   ├── useEmployeePayroll.ts      # Employee payroll data
│   ├── useEmployeeDocuments.ts    # Employee documents
│   ├── useWorkExperiences.ts      # Work experience data
│   ├── useFamilyMembers.ts        # Family members data
│   ├── useEducations.ts           # Formal education data
│   └── useInformalEducations.ts   # Informal education data
├── utils/                          # Utility functions
│   ├── index.ts                   # Utils export
│   └── devLogger.ts               # Development logger
├── types/                          # TypeScript types
├── index.ts                        # Main export file
└── README.md                       # This file
```

## Features

- **Leave Permit Management**: View employee leave/permit records and history
- **Auto-save**: Automatic form data saving
- **Tab Navigation**: Navigate between Personal, Address, and Employment tabs
- **Real-time Updates**: Live data synchronization with Supabase
- **Form Validation**: Employment data validation
- **Master Data Management**: Departments, Positions, Job Levels, Branches, Status
- **Performance Monitoring**: Request performance tracking
- **Error Handling**: Error boundary for error handling
- **Loading States**: Proper loading state management

## Usage

```tsx
import { EmployeeLeavePermit } from '@/components/1_halaman/2_1_employee/MyInfo/LeavePermit';

// Use in routing
<Route path="/my-info/leave-permit" element={<EmployeeLeavePermit />} />

// Import specific components
import { EmployeePageLayout } from '@/components/1_halaman/2_1_employee/MyInfo/LeavePermit';

// Import hooks
import { useEmployeeDetail } from '@/components/1_halaman/2_1_employee/MyInfo/LeavePermit';
```

## Migration Notes

This directory was created by migrating files from:

### Pages:
- `src/pages/EmployeeLeavePermit.tsx`

### Components:
All components are shared from PersonalInformation structure with the same employee-detail components.

### Hooks (16 files):
All hooks are shared from PersonalInformation, including:
- Supabase integration hooks
- Auto-save functionality
- Performance monitoring
- Employee data management

### Utilities:
- `devLogger.ts` - Development logging utility

All import references have been updated to use relative paths within this directory.

## Supabase Integration

### Read Operations (GET):
- `useEmployeeDetail` - Query employee data
- `useCurrentOrg` - Query organization data
- All employee detail hooks (payroll, documents, work experience, etc.)

### Write Operations (UPDATE):
- `useUpdateEmployee` - Update employee employment data
- `useAutoSave` - Auto-save employment changes

### CRUD Operations (Full CRUD):
- `useDepartmentsCrud` - Departments CRUD
- `useJobPositionsCrud` - Job Positions CRUD
- `useJobLevelsCrud` - Job Levels CRUD
- `useBranchesCrud` - Branches CRUD
- `useEmployeeStatusesCrud` - Employee Status CRUD

The page is now completely self-contained with all its dependencies.
