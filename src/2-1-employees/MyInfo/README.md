# MyInfo Pages

This directory contains all pages for the `/my-info` route - employee information pages.

## Structure

```
MyInfo/
├── PersonalInformation/        # Personal information page components
│   ├── pages/                 # Page components
│   ├── components/            # All components
│   ├── hooks/                 # All hooks
│   ├── utils/                 # Utility functions
│   ├── types/                 # TypeScript types
│   ├── index.ts              # Export file
│   └── README.md             # Documentation
├── AddressInformation/         # Address information page components
│   ├── pages/                 # Page components
│   ├── components/            # All components
│   ├── hooks/                 # All hooks
│   ├── utils/                 # Utility functions
│   ├── types/                 # TypeScript types
│   ├── index.ts              # Export file
│   └── README.md             # Documentation
├── Employment/                 # Employment information page components
│   ├── pages/                 # Page components
│   ├── components/            # All components
│   ├── hooks/                 # All hooks (including crudMaster)
│   ├── utils/                 # Utility functions
│   ├── types/                 # TypeScript types
│   ├── index.ts              # Export file
│   └── README.md             # Documentation
├── Education/                  # Education information page components
│   ├── pages/                 # Page components (2 files)
│   ├── components/            # All components
│   ├── hooks/                 # All hooks (including crudMaster)
│   ├── utils/                 # Utility functions
│   ├── types/                 # TypeScript types
│   ├── index.ts              # Export file
│   └── README.md             # Documentation
├── WorkExperience/             # Work experience page components
│   ├── pages/                 # Page components
│   ├── components/            # All components
│   ├── hooks/                 # All hooks (including crudMaster)
│   ├── utils/                 # Utility functions
│   ├── types/                 # TypeScript types
│   ├── index.ts              # Export file
│   └── README.md             # Documentation
├── FamilyMembers/              # Family members page components
│   ├── pages/                 # Page components
│   ├── components/            # All components
│   ├── hooks/                 # All hooks (including crudMaster)
│   ├── utils/                 # Utility functions
│   ├── types/                 # TypeScript types
│   ├── index.ts              # Export file
│   └── README.md             # Documentation
├── Attendance/                 # Attendance page components
│   ├── pages/                 # Page components
│   ├── components/            # All components
│   ├── hooks/                 # All hooks (including crudMaster)
│   ├── utils/                 # Utility functions
│   ├── types/                 # TypeScript types
│   ├── index.ts              # Export file
│   └── README.md             # Documentation
├── LeavePermit/                # Leave permit page components
│   ├── pages/                 # Page components
│   ├── components/            # All components
│   ├── hooks/                 # All hooks (including crudMaster)
│   ├── utils/                 # Utility functions
│   ├── types/                 # TypeScript types
│   ├── index.ts              # Export file
│   └── README.md             # Documentation
├── Documents/                  # Documents page components
│   ├── pages/                 # Page components
│   ├── components/            # All components
│   ├── hooks/                 # All hooks (including crudMaster)
│   ├── utils/                 # Utility functions
│   ├── types/                 # TypeScript types
│   ├── index.ts              # Export file
│   └── README.md             # Documentation
├── Payroll/                    # Payroll page components
│   ├── pages/                 # Page components
│   ├── components/            # All components
│   ├── hooks/                 # All hooks (including crudMaster)
│   ├── utils/                 # Utility functions
│   ├── types/                 # TypeScript types
│   ├── index.ts              # Export file
│   └── README.md             # Documentation
├── InformalEducation/          # Informal education page components
│   ├── pages/                 # Page components
│   ├── components/            # All components
│   ├── hooks/                 # All hooks (including crudMaster)
│   ├── utils/                 # Utility functions
│   ├── types/                 # TypeScript types
│   ├── index.ts              # Export file
│   └── README.md             # Documentation
├── index.ts                   # Main export (re-exports from subdirectories)
└── README.md                  # This file
```

## Pages

### Personal Information
- **Route**: `/my-info/personal?id={id}`
- **Location**: `./PersonalInformation`
- **Description**: Employee personal information management

### Address Information
- **Route**: `/my-info/address?id={id}`
- **Location**: `./AddressInformation`
- **Description**: Employee address information management

### Employment Information
- **Route**: `/my-info/employment?id={id}`
- **Location**: `./Employment`
- **Description**: Employee employment information management

### Education Information
- **Route**: `/my-info/education/formal?id={id}`
- **Location**: `./Education`
- **Description**: Employee formal education management

### Work Experience Information
- **Route**: `/my-info/work?id={id}`
- **Location**: `./WorkExperience`
- **Description**: Employee work history management

### Family Members Information
- **Route**: `/my-info/family?id={id}`
- **Location**: `./FamilyMembers`
- **Description**: Employee family members management

### Attendance Information
- **Route**: `/my-info/attendance?id={id}`
- **Location**: `./Attendance`
- **Description**: Employee attendance records and calendar

### Leave Permit Information
- **Route**: `/my-info/leave-permit?id={id}`
- **Location**: `./LeavePermit`
- **Description**: Employee leave/permit records and history

### Documents Information
- **Route**: `/my-info/documents?id={id}`
- **Location**: `./Documents`
- **Description**: Employee documents management

### Payroll Information
- **Route**: `/my-info/payroll?id={id}`
- **Location**: `./Payroll`
- **Description**: Employee payroll information management

### Informal Education Information
- **Route**: `/my-info/education/informal?id={id}`
- **Location**: `./InformalEducation`
- **Description**: Employee informal education/training records

## Usage

```tsx
import { 
  EmployeePersonalInfo, 
  EmployeeAddressInfo,
  EmployeeEmploymentInfo,
  EmployeeEducationFormal,
  EmployeeWork,
  EmployeeFamily,
  EmployeeAttendance,
  EmployeeLeavePermit,
  EmployeeDocuments,
  EmployeePayroll,
  EmployeeEducationInformal
} from '@/components/1_halaman/2_1_employee/MyInfo';

// Use in routing
<Route path="/my-info/personal" element={<EmployeePersonalInfo />} />
<Route path="/my-info/address" element={<EmployeeAddressInfo />} />
<Route path="/my-info/employment" element={<EmployeeEmploymentInfo />} />
<Route path="/my-info/education/formal" element={<EmployeeEducationFormal />} />
<Route path="/my-info/work" element={<EmployeeWork />} />
<Route path="/my-info/family" element={<EmployeeFamily />} />
<Route path="/my-info/attendance" element={<EmployeeAttendance />} />
<Route path="/my-info/leave-permit" element={<EmployeeLeavePermit />} />
<Route path="/my-info/documents" element={<EmployeeDocuments />} />
<Route path="/my-info/payroll" element={<EmployeePayroll />} />
<Route path="/my-info/education/informal" element={<EmployeeEducationInformal />} />
```

## Related Routes

## Complete!

All `/my-info` routes have been successfully migrated to self-contained directories.