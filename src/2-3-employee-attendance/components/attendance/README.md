# Attendance Components

This directory contains components related to employee attendance management functionality.

## Main Components

### Core Components
- **AttendanceTabs**: Main tab navigation for attendance management
- **AttendanceAnalytics**: Analytics dashboard for attendance data
- **AttendanceHistory**: Historical attendance records and statistics
- **PersonalAttendanceCalendar**: Personal attendance calendar view
- **FaceRegistrationDialog**: Face registration dialog for biometric attendance

## Features

### AttendanceTabs
- **Multi-tab Interface**: Dashboard, Employee, Analytics, Settings tabs
- **Integration**: Connects with existing attendance management system
- **Navigation**: Seamless tab switching with state management

### AttendanceAnalytics
- **Data Visualization**: Charts and graphs for attendance trends
- **Performance Metrics**: Attendance rates, late arrivals, absences
- **Reporting**: Comprehensive attendance reports

### AttendanceHistory
- **Historical Records**: Complete attendance history for employees
- **Statistics**: Monthly and daily attendance statistics
- **Status Tracking**: Present, late, absent, sick leave tracking
- **Working Hours**: Detailed working hours and overtime calculation

### PersonalAttendanceCalendar
- **Calendar View**: Monthly calendar with attendance status
- **Status Indicators**: Visual indicators for different attendance statuses
- **Statistics**: Personal attendance statistics and penalties
- **Navigation**: Month-by-month navigation
- **Integration**: Works with leave requests and national holidays

### FaceRegistrationDialog
- **Biometric Setup**: Face registration for biometric attendance
- **Camera Integration**: Camera capture functionality
- **User Interface**: Clean dialog interface for face registration

## Usage

These components are used in:
- **Pages**: `src/pages/Attendance.tsx`, `src/pages/EmployeeAttendance.tsx`
- **Routes**: `/attendance`, `/employee-attendance/:id`

## Integration Points

- Uses Supabase for data storage and real-time updates
- Integrates with existing attendance management system
- Supports biometric attendance with face recognition
- Includes comprehensive analytics and reporting
- Works with leave management and penalty systems

## Data Flow

1. **AttendanceTabs** provides the main navigation interface
2. **PersonalAttendanceCalendar** displays individual attendance data
3. **AttendanceHistory** shows historical records and statistics
4. **AttendanceAnalytics** provides insights and trends
5. **FaceRegistrationDialog** handles biometric setup

## Status Codes

- **H**: Hadir (Present)
- **I**: Izin (Permission)
- **S**: Sakit (Sick)
- **C**: Cuti (Leave)
- **A**: Alfa (Absent)
- **T**: Terlambat (Late)
