// MyInfo Page Hooks
// All hooks used by the /my-info pages

// Main hooks
export { useEmployeeDetail } from './useEmployeeDetail';
export { useUpdateEmployee } from './useUpdateEmployee';
export { useAutoSave } from '@/shared/hooks/useAutoSave';
export { usePerformanceMonitor } from '@/shared/hooks/usePerformanceMonitor';
export * from './useEmployees';

// Utility hooks
export { useShowToast } from '@/shared/hooks/useShowToast';
export { useCurrentOrg } from './useCurrentOrg';
export { getOptimizedCurrentOrganizationId } from './useOptimizedCurrentOrg';
export { useAvatarSync } from './useAvatarSync';

// Employee data hooks
export { useEmployeePayroll } from './useEmployeePayroll';
export { useEmployeeDocuments } from './useEmployeeDocuments';
export { useWorkExperiences } from './useWorkExperiences';
export { useFamilyMembers } from './useFamilyMembers';
export { useEducations } from './useEducations';
export { useInformalEducations } from './useInformalEducations';
