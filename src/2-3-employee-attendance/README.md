# Employee Attendance Management

## Deskripsi
Komponen untuk menampilkan dan mengelola employee attendance di halaman Attendance (/attendance/employee-attendance).

## Struktur Direktori
```
2_3_employee-attendance/
├── hooks/                              # Business logic & data management
│   ├── useAttendanceRecords.ts         # Hook untuk fetch attendance records
│   ├── useAttendanceValidation.ts      # Hook untuk validasi attendance
│   ├── useAttendanceOperations.ts      # Hook untuk operations (approve, reject, etc)
│   └── index.ts                        # Export all hooks
├── EmployeeAttendanceTab.tsx           # Main tab component (ACTIVE)
├── ResponsiveAttendanceTable.tsx       # Responsive table view
├── AttendanceCalendarView.tsx          # Calendar view
├── EnhancedAttendanceSidebar.tsx       # Analytics sidebar
├── AttendanceViewToggle.tsx            # Toggle between table/calendar
├── AttendanceTable.tsx                 # Basic table component
├── AdvancedAttendanceFilters.tsx       # Advanced filters
├── AttendanceTableFilters.tsx          # Basic filters
├── LateReasonModal.tsx                 # Modal untuk input alasan terlambat
├── EmployeePenaltyCell.tsx             # Cell untuk display penalties
├── index.ts                            # Export file
└── README.md                           # Dokumentasi
```

## Komponen

### EmployeeAttendanceTab (Main Component - ACTIVE)
Main component yang currently digunakan di `/attendance/employee-attendance` tab.

**Features:**
- 🔍 Advanced search & filtering
- 📊 Table view (ResponsiveAttendanceTable)
- 📅 Calendar view (AttendanceCalendarView)
- 📈 Analytics sidebar (EnhancedAttendanceSidebar)
- ⌨️ Keyboard navigation support
- 📤 Export functionality
- ✅ Bulk approve
- 🎯 Multi-select rows

**Props:**
```typescript
interface EmployeeAttendanceTabProps {
  currentView: 'table' | 'calendar';
}
```

**Filter State:**
```typescript
interface FilterState {
  searchTerm: string;
  selectedDepartment: string;
  selectedStatus: string[];
  selectedWorkType: string[];
  dateRange: { from: Date | undefined; to: Date | undefined };
  workHoursRange: { min: number; max: number };
  scoreRange: { min: number; max: number };
  locationFilter: string;
  flagsFilter: string[];
  showOnlyFlagged: boolean;
}
```

### ResponsiveAttendanceTable
Responsive table view untuk attendance records.

**Columns:**
- Employee (Avatar + Name)
- Date
- Clock In/Out
- Work Hours
- Location
- Status
- Penalties
- Score
- Actions

**Features:**
- Multi-select rows
- Sortable columns
- Inline editing
- Quick actions
- Mobile responsive

### AttendanceCalendarView
Calendar view untuk visualisasi attendance monthly.

**Features:**
- Monthly calendar grid
- Color-coded status (Present, Absent, Late, Leave, Holiday)
- Employee list dengan attendance summary
- Penalty display per employee
- Navigation (prev/next month)
- Search employees
- Export functionality

**Visual Indicators:**
- 🟢 Present - Green
- 🔴 Absent - Red
- 🟡 Late - Yellow
- 🔵 Leave - Blue
- ⚪ Holiday - Gray
- ⬜ Not yet - White

### EnhancedAttendanceSidebar
Analytics sidebar dengan comprehensive metrics.

**Sections:**
- 📊 Attendance Overview (today's stats)
- 📈 Trends & Insights
- 🏆 Top Performers
- ⚠️ Flagged Records
- ⌨️ Keyboard Shortcuts

**Props:**
```typescript
interface EnhancedAttendanceSidebarProps {
  selectedRows: string[];
  onKeyboardShortcutsToggle?: () => void;
}
```

### AttendanceViewToggle
Toggle button untuk switch between table and calendar view.

**Props:**
```typescript
interface AttendanceViewToggleProps {
  currentView: 'table' | 'calendar';
  onViewChange: (view: 'table' | 'calendar') => void;
}
```

### AttendanceTable
Basic table component (legacy/alternative).

### AdvancedAttendanceFilters
Advanced filter component dengan multiple filter options.

**Filters:**
- Search (name, employee code)
- Department
- Status (Present, Absent, Late, etc)
- Work Type (WFO, WFH, Hybrid)
- Date Range
- Work Hours Range
- Score Range
- Location
- Flags

### AttendanceTableFilters
Basic filter component.

### LateReasonModal
Modal untuk input alasan terlambat.

**Fields:**
- Reason (textarea)
- Supporting documents (upload)
- Timestamp

### EmployeePenaltyCell
Cell component untuk display penalties di table/calendar.

**Display:**
- Penalty count
- Penalty amount (Rupiah)
- Color indicator
- Tooltip with details

## Hooks

### useAttendanceRecords
Custom hook untuk fetch attendance records.

**Returns:**
```typescript
{
  records: AttendanceRecord[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}
```

**AttendanceRecord Interface:**
```typescript
interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  work_hours: number;
  work_type: 'wfo' | 'wfh' | 'hybrid';
  location_name?: string;
  status: 'present' | 'absent' | 'late' | 'leave' | 'holiday';
  penalties?: number;
  penalty_amount?: number;
  score?: number;
  notes?: string;
  employees?: {
    full_name: string;
    employee_code?: string;
    department_name?: string;
    photo_url?: string;
  };
}
```

### useAttendanceValidation
Hook untuk validasi attendance data.

**Features:**
- Validate clock in/out times
- Check late arrival
- Check early departure
- Validate work hours
- Location validation

### useAttendanceOperations
Hook untuk attendance operations.

**Operations:**
- Approve attendance
- Reject attendance
- Bulk approve
- Update status
- Add notes
- Apply penalties

## Integrasi
Digunakan di:
- `src/pages/Attendance.tsx` - Tab "employee-attendance"
- `src/components/Attendance/AttendanceTabs.tsx` - Legacy tabs

## Usage

### Import Main Component
```tsx
import { EmployeeAttendanceTab, AttendanceViewToggle } from '@/components/1_halaman/2_3_employee-attendance';

const [currentView, setCurrentView] = useState<'table' | 'calendar'>('table');

<AttendanceViewToggle 
  currentView={currentView} 
  onViewChange={setCurrentView} 
/>

<EmployeeAttendanceTab currentView={currentView} />
```

### Import Hooks
```tsx
import { 
  useAttendanceRecords,
  useAttendanceValidation,
  useAttendanceOperations 
} from '@/components/1_halaman/2_3_employee-attendance/hooks';

const { records, isLoading } = useAttendanceRecords(organizationId);
const { validateAttendance } = useAttendanceValidation();
const { approveAttendance } = useAttendanceOperations();
```

### Import Individual Components
```tsx
import { 
  ResponsiveAttendanceTable,
  AttendanceCalendarView,
  EnhancedAttendanceSidebar,
  LateReasonModal,
  EmployeePenaltyCell
} from '@/components/1_halaman/2_3_employee-attendance';
```

## Features
- ✅ Dual view (Table & Calendar)
- ✅ Advanced search & filtering
- ✅ Multi-select & bulk actions
- ✅ Keyboard navigation
- ✅ Penalty tracking
- ✅ Work hours calculation
- ✅ Status management
- ✅ Export to Excel/CSV
- ✅ Real-time analytics
- ✅ Mobile responsive
- ✅ Late reason tracking
- ✅ Location verification

## Attendance Status
- `present` - Hadir tepat waktu
- `late` - Terlambat
- `absent` - Tidak hadir
- `leave` - Cuti/izin
- `holiday` - Hari libur
- `wfh` - Work From Home
- `wfo` - Work From Office

## Work Types
- `wfo` - Work From Office
- `wfh` - Work From Home
- `hybrid` - Kombinasi WFO & WFH

## Dependencies
- `@tanstack/react-query` - Data fetching & caching
- `date-fns` - Date manipulation
- Supabase client - Database operations
- UI components dari shadcn/ui
- `useKeyboardNavigation` - Keyboard shortcuts
- `useEmployees` - Employee data
- `useWorkScheduleSettings` - Work schedule
- `useLeaveRequests` - Leave data

## Data Sources
- `attendance_records` table - Attendance data
- `employees` table - Employee information
- `attendance_penalties` table - Penalty records
- `work_schedules` table - Work schedule rules
- `leave_requests` table - Leave/izin data
- `national_holidays` table - Holiday data



