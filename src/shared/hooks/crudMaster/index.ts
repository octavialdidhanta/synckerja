// CRUD Master Data Hooks
// All CRUD hooks for master data management

export { useDepartmentsCrud } from './useDepartmentsCrud';
export { useJobPositionsCrud } from './useJobPositionsCrud';
export { useJobLevelsCrud } from './useJobLevelsCrud';
export { useBranchesCrud } from './useBranchesCrud';
export { useEmployeeStatusesCrud } from './useEmployeeStatusesCrud';

// Re-export types
export type { Department } from './departmentTypes';
export type { JobPosition } from './jobPositionTypes';
export type { JobLevel } from './jobLevelTypes';
export type { Branch } from './branchTypes';
export type { EmployeeStatus } from './employeeStatusTypes';


