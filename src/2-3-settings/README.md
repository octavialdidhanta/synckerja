# Attendance Settings

## Deskripsi
Komponen untuk menampilkan dan mengelola attendance settings di halaman Attendance (/attendance/settings).

## Struktur Direktori
```
2_3_settings/
├── AttendanceSettings.tsx                  # Main settings component
├── AttendanceSettingsLayout.tsx            # Layout dengan sidebar navigation
├── AttendanceErrorBoundary.tsx             # Error boundary wrapper
├── WorkScheduleSettings.tsx                # Work schedule configuration
├── AttendanceRulesSettings.tsx             # Attendance rules configuration
├── ComprehensivePenaltySettings.tsx        # Penalty settings
├── ShiftSettings.tsx                       # Shift management settings
├── IPAddressSettings.tsx                   # IP address whitelist
├── OptimizedOfficeLocationsList.tsx        # Office locations list
├── ClientManagement.tsx                    # Client management
├── VisitScheduling.tsx                     # Visit scheduling
├── ShiftManagement.tsx                     # Shift management
├── EmployeeShiftAssignment.tsx             # Employee shift assignment
├── AddOfficeLocationModal.tsx              # Add location modal
├── EditOfficeLocationModal.tsx             # Edit location modal
├── AddClientModal.tsx                      # Add client modal
├── LocationTypesCRUD.tsx                   # Location types management
├── PenaltyRuleFormDialog.tsx               # Penalty rule form
├── PenaltyMigrationGuide.tsx               # Migration guide
├── ManualHolidayForm.tsx                   # Add holiday form
├── GoogleMapsSetup.tsx                     # Google Maps setup
├── GoogleMapsLocationSelector.tsx          # Maps location selector
├── ModernGoogleMapsSelector.tsx            # Modern maps selector
├── ModernGoogleMapsSelector.css            # Maps selector styles
├── UnifiedLocationSelector.tsx             # Unified location selector
├── ManualLocationInput.tsx                 # Manual location input
├── index.ts                                # Export file
└── README.md                               # Dokumentasi
```

## Komponen

### AttendanceSettings (Main Component)
Main component dengan error boundary wrapper.

**Structure:**
```tsx
<AttendanceErrorBoundary>
  <AttendanceSettingsLayout />
</AttendanceErrorBoundary>
```

### AttendanceSettingsLayout
Layout component dengan sidebar navigation untuk berbagai settings sections.

**Sections:**
1. 📅 **Jadwal Kerja** (Work Schedule)
   - Pengaturan hari kerja
   - Jam kerja
   - Hari libur nasional
   
2. 👤 **Pengaturan Shift** (Shift Settings)
   - Kelola shift kerja
   - Penugasan karyawan ke shift
   
3. 📋 **Aturan Absensi** (Attendance Rules)
   - Validasi absensi
   - Persyaratan absensi
   
4. 💰 **Pengaturan Denda** (Penalty Settings)
   - Konfigurasi denda keterlambatan
   - Penalty rules
   
5. 📍 **Lokasi Kantor** (Office Locations)
   - Kelola lokasi kantor
   - Google Maps integration
   
6. 🏢 **Manajemen Klien** (Client Management)
   - Kelola klien
   - Lokasi klien
   
7. 🗓️ **Visit Scheduling** (Kunjungan)
   - Jadwal kunjungan ke klien
   - Location visits
   
8. 🌐 **IP Address Settings**
   - IP whitelist
   - Network security

### WorkScheduleSettings
Pengaturan jadwal kerja.

**Features:**
- Set working days
- Set working hours
- Add national holidays
- Add company holidays
- Edit holiday list

### AttendanceRulesSettings
Konfigurasi aturan absensi.

**Rules:**
- Late tolerance (minutes)
- Early departure tolerance
- Missing clock in/out handling
- Location validation radius
- Face recognition settings

### ComprehensivePenaltySettings
Comprehensive penalty configuration.

**Features:**
- Create penalty rules
- Set penalty amounts
- Define penalty types
- Auto-apply rules
- Waiver policies
- Penalty migration guide

### ShiftSettings
Shift management settings.

**Features:**
- Create shifts
- Define shift hours
- Set shift patterns
- Assign employees

### IPAddressSettings
IP address whitelist management.

**Features:**
- Add IP addresses
- Remove IP addresses
- Enable/disable IP validation
- Test IP connectivity

### OptimizedOfficeLocationsList
List dan manage office locations.

**Features:**
- Add new location
- Edit location
- Delete location
- Google Maps integration
- Set geofence radius
- Location type

### ClientManagement
Manage clients dan locations.

**Features:**
- Add client
- Edit client
- Delete client
- Manage client locations
- Set visit schedules

### Google Maps Components
- **GoogleMapsSetup**: Initial setup dan API key
- **GoogleMapsLocationSelector**: Select location on map
- **ModernGoogleMapsSelector**: Modern UI selector
- **UnifiedLocationSelector**: Unified interface
- **ManualLocationInput**: Manual lat/long input

## Integrasi
Digunakan di:
- `src/pages/Attendance.tsx` - Tab "settings"
- `src/components/Attendance/AttendanceTabs.tsx` - Legacy tabs

## Usage

### Import Main Component
```tsx
import { AttendanceSettings } from '@/components/1_halaman/2_3_settings';

<TabsContent value="settings">
  <AttendanceSettings />
</TabsContent>
```

### Import Individual Components
```tsx
import { 
  WorkScheduleSettings,
  ComprehensivePenaltySettings,
  OptimizedOfficeLocationsList,
  GoogleMapsLocationSelector
} from '@/components/1_halaman/2_3_settings';
```

## Features
- ✅ Work schedule management
- ✅ Shift configuration
- ✅ Attendance rules
- ✅ Penalty settings
- ✅ Office locations with Google Maps
- ✅ Client management
- ✅ Visit scheduling
- ✅ IP address whitelist
- ✅ Holiday management
- ✅ Error boundary protection
- ✅ Sidebar navigation
- ✅ Responsive layout

## Settings Categories

### 1. Time & Schedule
- Work days
- Work hours
- Holidays
- Shift patterns

### 2. Locations
- Office locations
- Client locations
- Geofencing
- Maps integration

### 3. Rules & Policies
- Attendance rules
- Penalty rules
- Validation settings
- Security settings

### 4. Assignments
- Shift assignments
- Location assignments
- Employee scheduling

## Dependencies
- Google Maps API - Location services
- Supabase client - Database operations
- UI components dari shadcn/ui
- React Hook Form - Form management
- Date-fns - Date handling

## Data Sources
- `work_schedules` table - Work schedule data
- `office_locations` table - Office locations
- `clients` table - Client data
- `penalty_rules` table - Penalty configurations
- `shifts` table - Shift data
- `employee_shifts` table - Shift assignments
- `national_holidays` table - Holiday data
- `ip_whitelist` table - IP addresses



