// Main Component
export { default as AttendanceSettings } from './components/AttendanceSettings';
export { default } from './components/AttendanceSettings'; // Default export for lazy loading

// Layout & Error Boundary
export { AttendanceSettingsLayout } from './components/AttendanceSettingsLayout';
export { AttendanceErrorBoundary } from './components/AttendanceErrorBoundary';

// Settings Sections
export { WorkScheduleSettings } from './components/WorkScheduleSettings';
export { AttendanceRulesSettings } from './components/AttendanceRulesSettings';
export { ComprehensivePenaltySettings } from './components/ComprehensivePenaltySettings';
export { ShiftSettings } from './components/ShiftSettings';
export { IPAddressSettings } from './components/IPAddressSettings';

// Management Components
export { OptimizedOfficeLocationsList } from './components/OptimizedOfficeLocationsList';
export { ClientManagement } from './components/ClientManagement';
export { VisitScheduling } from './components/VisitScheduling';
export { ShiftManagement } from './components/ShiftManagement';
export { EmployeeShiftAssignment } from './components/EmployeeShiftAssignment';

// Modals & Forms
export { AddOfficeLocationModal } from './modals/AddOfficeLocationModal';
export { EditOfficeLocationModal } from './modals/EditOfficeLocationModal';
export { AddClientModal } from './modals/AddClientModal';
export { LocationTypesCRUD } from './components/LocationTypesCRUD';
export { PenaltyRuleFormDialog } from './modals/PenaltyRuleFormDialog';
export { PenaltyMigrationGuide } from './components/PenaltyMigrationGuide';
export { ManualHolidayForm } from './components/ManualHolidayForm';

// Google Maps Components
export { GoogleMapsSetup } from './components/GoogleMapsSetup';
export { GoogleMapsLocationSelector } from './components/GoogleMapsLocationSelector';
export { GoogleMapsAddressSearch } from './components/GoogleMapsAddressSearch';
export { ModernGoogleMapsSelector } from './components/ModernGoogleMapsSelector';
export { UnifiedLocationSelector } from './components/UnifiedLocationSelector';
export { ManualLocationInput } from './components/ManualLocationInput';
export { InteractiveLocationMap } from './components/InteractiveLocationMap';
export { MapLocationSelector } from './components/MapLocationSelector';
export { InteractiveMapLocationSelector } from './components/InteractiveMapLocationSelector';

// Visit & Location Components
export { LocationVisitsList } from './components/LocationVisitsList';
export { EnhancedAddOfficeLocationModal } from './modals/EnhancedAddOfficeLocationModal';
export { EnhancedFaceRegistration } from './components/EnhancedFaceRegistration';

// Hooks (also available via ./hooks/* paths)
export * from './hooks';
