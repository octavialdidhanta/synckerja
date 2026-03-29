// Payroll Information Page Types
// All types and interfaces re-exported from hooks for convenience

// Employee types
export type { Employee } from '../hooks/useEmployees';

// Education types
export type { Education } from '../hooks/useEducations';
export type { InformalEducation } from '../hooks/useInformalEducations';

// Work experience types
export type { WorkExperience } from '../hooks/useWorkExperiences';

// Family types
export type { FamilyMember } from '../hooks/useFamilyMembers';

// Document types
export type { EmployeeDocument } from '../hooks/useEmployeeDocuments';

// Payroll types
export type { EmployeePayrollInfo, PayrollComponent } from '../hooks/useEmployeePayroll';
export type { PayrollPeriod } from '../hooks/usePayrollPeriods';

// Profile types
export type { Profile } from '../hooks/useProfile';

// CRUD Master Data types
export type { 
  Department,
  JobPosition,
  JobLevel,
  Branch,
  EmployeeStatus
} from '../hooks/crudMaster';
