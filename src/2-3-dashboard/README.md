# Attendance Dashboard

## Deskripsi
Komponen untuk menampilkan attendance dashboard di halaman Attendance (/attendance/dashboard).

## Struktur Direktori
```
2_3_dashboard/
├── hooks/                              # Business logic & data management
│   ├── useAttendancePenalties.ts       # Hook untuk fetch attendance penalties
│   ├── useAttendanceAnalytics.ts       # Hook untuk analytics data
│   └── index.ts                        # Export all hooks
├── DashboardOverview.tsx               # Main dashboard component
├── PenaltyStatistics.tsx               # Penalty statistics cards (4 cards)
├── RecentPenaltiesWidget.tsx           # Recent penalties list widget
├── PenaltyTrendsChart.tsx              # Penalty trends chart
├── AttendanceAnalyticsDashboard.tsx    # Full analytics dashboard
├── index.ts                            # Export file
└── README.md                           # Dokumentasi
```

## Komponen

### DashboardOverview (Main Component)
Main dashboard component yang mengintegrasikan semua sub-components.

**Layout:**
- Penalty Statistics (4 cards)
- Grid Layout (Recent Penalties + Trends Chart)
- Full Analytics Dashboard

**Props:** None (standalone component)

### PenaltyStatistics
4 Metrics cards untuk penalty statistics:
- 🚨 Total Penalties - Total jumlah penalties
- ✅ Active Penalties - Penalties yang masih aktif
- 💰 Total Amount - Total nominal penalties (Rupiah)
- 📉 Waiver Rate - Persentase penalties yang di-waive

**Props:**
```typescript
interface PenaltyStatsProps {
  organizationId?: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
}
```

**Features:**
- Auto-calculation from penalties data
- Trend indicators
- Progress bars
- Color-coded badges
- Loading skeleton

### RecentPenaltiesWidget
Widget untuk menampilkan recent penalties list.

**Features:**
- Shows latest 5 penalties
- Employee avatar
- Penalty type badge
- Amount display
- Time ago (relative time)
- Quick actions (View, More)

**Data Source:**
- Uses `useAttendancePenalties` hook
- Sorted by applied_date (newest first)

### PenaltyTrendsChart
Chart untuk menampilkan penalty trends over time.

**Features:**
- Monthly penalty count
- Line/Bar chart visualization
- Last 6 months data
- Interactive tooltips
- Responsive chart

**Chart Library:**
- Recharts (ResponsiveContainer, LineChart, BarChart)

### AttendanceAnalyticsDashboard
Full analytics dashboard dengan comprehensive metrics.

**Sections:**
- Attendance overview
- Department breakdown
- Time-based analytics
- Performance metrics

## Hooks

### useAttendancePenalties
Custom hook untuk fetch attendance penalties data.

**Returns:**
```typescript
{
  penalties: AttendancePenalty[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}
```

**AttendancePenalty Interface:**
```typescript
interface AttendancePenalty {
  id: string;
  employee_id: string;
  attendance_record_id?: string;
  penalty_rule_id: string;
  applied_date: string;
  penalty_amount: number;
  penalty_type: string;
  reason?: string;
  status: 'active' | 'waived' | 'paid';
  waived_by?: string;
  waived_at?: string;
  waived_reason?: string;
  created_at: string;
  updated_at: string;
  employees?: {
    full_name: string;
    employee_code?: string;
    photo_url?: string;
  };
  penalty_rules?: {
    rule_name: string;
    penalty_type: string;
  };
}
```

### useAttendanceAnalytics
Custom hook untuk fetch attendance analytics data.

**Returns:**
```typescript
{
  analytics: AttendanceAnalytics;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}
```

## Integrasi
Digunakan di:
- `src/pages/Attendance.tsx` - Tab "dashboard"
- `src/components/Attendance/AttendanceTabs.tsx` - Legacy tabs

## Usage

### Import Main Component
```tsx
import DashboardOverview from '@/components/1_halaman/2_3_dashboard';

// In Attendance.tsx
<TabsContent value="dashboard">
  <div className="p-4">
    <DashboardOverview />
  </div>
</TabsContent>
```

### Import Individual Components
```tsx
import { 
  PenaltyStatistics,
  RecentPenaltiesWidget,
  PenaltyTrendsChart,
  AttendanceAnalyticsDashboard
} from '@/components/1_halaman/2_3_dashboard';
```

### Import Hooks
```tsx
import { 
  useAttendancePenalties,
  useAttendanceAnalytics 
} from '@/components/1_halaman/2_3_dashboard/hooks';

const MyComponent = () => {
  const { penalties, loading } = useAttendancePenalties();
  const { analytics } = useAttendanceAnalytics();
  
  return (
    <div>
      {penalties.map(penalty => (
        <div key={penalty.id}>{penalty.penalty_type}</div>
      ))}
    </div>
  );
};
```

## Features
- ✅ Penalty statistics overview
- ✅ Recent penalties list
- ✅ Penalty trends chart
- ✅ Full analytics dashboard
- ✅ Real-time data fetching
- ✅ Loading states
- ✅ Error handling
- ✅ Responsive layout
- ✅ Date range filtering
- ✅ Organization filtering

## Penalty Types
- `late_arrival` - Terlambat datang
- `early_departure` - Pulang lebih awal
- `absence` - Tidak hadir
- `missing_clockin` - Lupa clock in
- `missing_clockout` - Lupa clock out
- `overtime_violation` - Pelanggaran lembur

## Penalty Status
- `active` - Aktif (belum dibayar/di-waive)
- `waived` - Di-waive oleh manager
- `paid` - Sudah dibayar

## Dependencies
- `@tanstack/react-query` - Data fetching & caching
- `date-fns` - Date formatting & manipulation
- `recharts` - Chart visualization
- Supabase client - Database operations
- UI components dari shadcn/ui

## Data Sources
- `attendance_penalties` table - Penalty records
- `employees` table - Employee information
- `penalty_rules` table - Penalty rule definitions
- `attendance_records` table - Attendance data



