# MyInfo Pages

This directory contains all components, hooks, and files for the `/my-info` pages functionality - specifically for employee personal information pages.

## Complete Structure

```
MyInfo/
├── pages/                          # Page components
│   └── EmployeePersonalInfo.tsx   # /my-info/personal?id={id} page
├── components/                     # All components
│   └── employee-detail/           # Employee detail components
│       ├── PersonalInfoTab.tsx    # Personal information tab
│       ├── PersonalInfoForm.tsx   # Personal information form
│       ├── AddressInfoTab.tsx     # Address information tab
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

- **Employee Personal Information**: View and edit personal details
- **Address Information**: Manage employee address data
- **Employment Information**: Employment details and job information
- **Education Information**: Formal and informal education records
- **Work Experience**: Work history and experience
- **Family Information**: Family members and dependents
- **Documents**: Document management and uploads
- **Payroll Information**: Payroll details and components
- **Auto-save**: Automatic form data saving
- **Performance Monitoring**: Request performance tracking
- **Real-time Updates**: Live data synchronization with Supabase

## Usage

```tsx
import { EmployeePersonalInfo } from '@/components/1_halaman/2_1_employee/MyInfo';

// Use in routing
<Route path="/my-info/personal" element={<EmployeePersonalInfo />} />

// Import specific components
import { PersonalInfoTab, EmployeePageLayout } from '@/components/1_halaman/2_1_employee/MyInfo';

// Import hooks
import { useEmployeeDetail, useUpdateEmployee } from '@/components/1_halaman/2_1_employee/MyInfo';
```

## Migration Notes

This directory was created by migrating ALL related files from:

### Pages:
- `src/pages/EmployeePersonalInfo.tsx`

### Components:
- `src/components/EmployeeDetail/` - All employee detail components
- `src/components/1_halaman/2_1_employee/components/employee-detail/` - Organized versions

### Hooks (16 files):
- `src/hooks/organized/employee/useEmployeeDetail.ts` - Main employee detail hook
- `src/hooks/organized/employee/useUpdateEmployee.ts` - Update employee hook
- `src/hooks/organized/utils/useAutoSave.ts` - Auto-save functionality
- `src/hooks/organized/employee/usePerformanceMonitor.ts` - Performance monitoring
- `src/hooks/organized/employee/useEmployees.ts` - Employee types
- `src/hooks/organized/utils/useShowToast.ts` - Toast notifications
- `src/hooks/organized/utils/useCurrentOrg.ts` - Current organization
- `src/hooks/organized/utils/useOptimizedCurrentOrg.ts` - Optimized org fetching
- `src/hooks/organized/employee/useAvatarSync.ts` - Avatar sync
- `src/hooks/organized/employee/useEmployeePayroll.ts` - Payroll data
- `src/hooks/organized/employee/useEmployeeDocuments.ts` - Documents data
- `src/hooks/organized/employee/useWorkExperiences.ts` - Work experience data
- `src/hooks/organized/employee/useFamilyMembers.ts` - Family members data
- `src/hooks/organized/employee/useEducations.ts` - Education data
- `src/hooks/organized/employee/useInformalEducations.ts` - Informal education data

### Utilities:
- `src/utils/devLogger.ts` - Development logging utility

All import references have been updated to use relative paths within this directory for core functionality. Some hooks still reference `@/hooks/organized` for shared utilities that are used across multiple pages.

## Related Pages

This MyInfo directory currently contains the personal info page. Other related pages in the `/my-info` route include:
- `/my-info/address` - Address information page
- `/my-info/employment` - Employment information page
- `/my-info/education` - Education information page
- `/my-info/work` - Work experience page
- `/my-info/family` - Family information page
- `/my-info/documents` - Documents page
- `/my-info/payroll` - Payroll page
- `/my-info/attendance` - Attendance page
- `/my-info/leave-permit` - Leave and permit page

These pages share the same components from the `employee-detail` directory.
