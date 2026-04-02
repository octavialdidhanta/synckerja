// Informal education page — shared data hooks live in @/shared/hooks/*

export { useEmployeeDetail } from '@/2-1-employees/MyInfo/PersonalInformation/hooks/useEmployeeDetail';
export { useAvatarSync } from '@/2-1-employees/MyInfo/PersonalInformation/hooks/useAvatarSync';
export { useUpdateEmployee } from '@/2-1-employees/MyInfo/PersonalInformation/hooks/useUpdateEmployee';
export { useAutoSave } from '@/shared/hooks/useAutoSave';
export { usePerformanceMonitor } from '@/shared/hooks/usePerformanceMonitor';

export * from '@/shared/hooks/employees';
export { useShowToast } from '@/shared/hooks/useShowToast';
export { useCurrentOrg, getCurrentOrganizationId } from '@/2-1-employees/MyInfo/WorkExperience/hooks/useCurrentOrg';
export { getOptimizedCurrentOrganizationId } from '@/shared/hooks/employees/useOptimizedCurrentOrg';

export * from '@/shared/hooks/crudMaster';
