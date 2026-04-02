// Informal Education Information Page Types
// All types and interfaces re-exported from hooks for convenience

// Employee types
export type { Employee } from '@/shared/hooks/employees/useEmployees';

// Education types
export type { Education } from '@/shared/hooks/employees/useEducations';
export type { InformalEducation } from '@/shared/hooks/employees/useInformalEducations';

// Work experience types
export type { WorkExperience } from '@/shared/hooks/employees/useWorkExperiences';

// Family types
export type { FamilyMember } from '@/shared/hooks/employees/useFamilyMembers';

// Document types
export type { EmployeeDocument } from '@/shared/hooks/employees/useEmployeeDocuments';

// Payroll types
export type { EmployeePayrollInfo, PayrollComponent } from '@/shared/hooks/employees/useEmployeePayroll';
export type { PayrollPeriod } from '@/shared/hooks/employees/usePayrollPeriods';

// Profile types
export type { ProfileRow as Profile } from '@/shared/hooks/useProfile';

// CRUD Master Data types
export type { 
  Department,
  JobPosition,
  JobLevel,
  Branch,
  EmployeeStatus
} from '@/shared/hooks/crudMaster';
