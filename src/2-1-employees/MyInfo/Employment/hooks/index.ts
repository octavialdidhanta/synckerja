// Employment Information Page Hooks
// All hooks used by the /my-info/employment page

// Main hooks
export { useEmployeeDetail } from './useEmployeeDetail';
export { useUpdateEmployee } from '../../PersonalInformation/hooks/useUpdateEmployee';
export { useAutoSave } from '@/shared/hooks/useAutoSave';
export { usePerformanceMonitor } from '@/shared/hooks/usePerformanceMonitor';
export * from './useEmployees';

// Utility hooks
export { useShowToast } from '@/shared/hooks/useShowToast';
export { useCurrentOrg, getCurrentOrganizationId } from './useCurrentOrg';
export { getOptimizedCurrentOrganizationId } from './useOptimizedCurrentOrg';
export { useAvatarSync } from './useAvatarSync';

// Employee data hooks
export { useEmployeePayroll } from './useEmployeePayroll';
export { useEmployeeDocuments } from './useEmployeeDocuments';
export { useWorkExperiences } from './useWorkExperiences';
export { useFamilyMembers } from './useFamilyMembers';
export { useEducations } from './useEducations';
export { useInformalEducations } from './useInformalEducations';

// Additional hooks for address page
export { usePayrollPeriods } from './usePayrollPeriods';
export { useProfile } from './useProfile';

// CRUD Master Data Hooks
export * from './crudMaster';
