// MyInfo Page Hooks — page-local utilities; shared data hooks live in @/shared/hooks/employees

export { useEmployeeDetail } from './useEmployeeDetail';
export { useUpdateEmployee } from './useUpdateEmployee';
export { useAutoSave } from '@/shared/hooks/useAutoSave';
export { usePerformanceMonitor } from '@/shared/hooks/usePerformanceMonitor';

export * from '@/shared/hooks/employees';

export { useShowToast } from '@/shared/hooks/useShowToast';
export { useCurrentOrg } from './useCurrentOrg';
export { getOptimizedCurrentOrganizationId } from '@/shared/hooks/employees/useOptimizedCurrentOrg';
export { useAvatarSync } from './useAvatarSync';
