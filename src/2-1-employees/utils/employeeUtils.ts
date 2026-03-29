import type { Employee } from '../hooks/useEmployees';

/** Status values that mean the employee is NOT active (resigned, terminated, etc.). */
const NON_ACTIVE_STATUSES = new Set([
  'inactive',
  'terminated',
  'resigned',
  'resign',
  'resignation',
  'pending removal',
  'pendingremoval',
]);

/** Org-defined labels may be e.g. "Resign" or "Under termination" — not only canonical set members */
function normalizedStatusImpliesNonActive(normalized: string): boolean {
  if (!normalized) return false;
  if (normalized.includes('resign')) return true;
  if (normalized.includes('terminat')) return true;
  return false;
}

/**
 * Active / assignable employee: not pending removal and not in a terminal non-active status.
 * Uses legacy `employees.status` and/or `employee_statuses.name` when present; if either marks
 * inactive/terminated/resigned, the employee is excluded.
 *
 * After `employees.status` is omitted from API selects, many rows only have `employee_status_name`
 * values like "Probation" or "Contract". Those must still count as active — the old strict rule
 * (name must equal "active") incorrectly dropped everyone except a few rows named exactly "Active".
 */
export const isEmployeeActive = (employee: {
  employee_status_name?: string | null;
  status?: string | null;
  pending_removal?: boolean | null;
}): boolean => {
  if (employee.pending_removal === true) {
    return false;
  }

  const statusFromField = (employee.status ?? '').toString().trim().toLowerCase();
  const statusFromName = (employee.employee_status_name ?? '').toString().trim().toLowerCase();

  if (NON_ACTIVE_STATUSES.has(statusFromField) || NON_ACTIVE_STATUSES.has(statusFromName)) {
    return false;
  }
  if (normalizedStatusImpliesNonActive(statusFromField) || normalizedStatusImpliesNonActive(statusFromName)) {
    return false;
  }
  return true;
};

/**
 * Determine if an employee should appear in organizational structure (e.g. /company/organization).
 * Same rule set as {@link isEmployeeActive}.
 */
export const isEmployeeInOrganizationalStructure = (employee: {
  employee_status_name?: string | null;
  status?: string | null;
  pending_removal?: boolean | null;
}): boolean => isEmployeeActive(employee);

/**
 * Managers eligible for `employee`: same org implied by caller; not self;
 * same department as employee unless candidate is organization owner.
 */
export const getEligibleManagersForEmployee = (
  employee: Employee,
  allEmployees: Employee[]
): Employee[] => {
  return allEmployees.filter((c) => {
    if (c.id === employee.id) return false;
    if (!isEmployeeInOrganizationalStructure(c)) return false;
    if (c.is_organization_owner) return true;
    if (!employee.department_id || !c.department_id) return false;
    return c.department_id === employee.department_id;
  });
};

/**
 * Get employee status for display
 * Returns the status name or 'Active' as default
 * If pending_removal is true, returns 'Pending Removal'
 */
export const getEmployeeStatus = (employee: {
  employee_status_name?: string | null;
  status?: string | null;
  pending_removal?: boolean | null;
}): string => {
  // If pending_removal is true, show "Pending Removal" status
  // Check both boolean true and string "true" for safety
  if (employee.pending_removal === true || employee.pending_removal === 'true') {
    return 'Pending Removal';
  }
  
  const statusName = employee.employee_status_name?.trim();
  const statusField = employee.status?.trim();
  
  // Helper to capitalize status properly
  const capitalizeStatus = (status: string): string => {
    if (!status) return status;
    // Handle multi-word statuses (e.g., "on leave" -> "On Leave")
    return status.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  };
  
  // CRITICAL: If status field shows a non-active status (terminated, inactive, etc),
  // prioritize it over employee_status_name to ensure sync with detail page
  // This handles cases where employee_status_id points to wrong status
  if (statusField && statusField.toLowerCase() !== 'active') {
    return capitalizeStatus(statusField);
  }
  
  // If status field is 'active' or null, use employee_status_name if available
  if (statusName && statusName !== '') {
    return capitalizeStatus(statusName);
  }
  
  // If status field exists (even if 'active'), use it
  if (statusField && statusField !== '') {
    return capitalizeStatus(statusField);
  }
  
  // Default to 'Active' only if both are null/undefined/empty
  return 'Active';
};

/**
 * Get employee status in lowercase for filtering
 * Uses same priority logic as getEmployeeStatus() for consistency
 */
export const getEmployeeStatusForFilter = (employee: {
  employee_status_name?: string | null;
  status?: string | null;
  pending_removal?: boolean | null;
}): string => {
  // If pending_removal, return 'pending-removal'
  if (employee.pending_removal === true || employee.pending_removal === 'true') {
    return 'pending-removal';
  }
  
  const statusName = employee.employee_status_name?.trim().toLowerCase();
  const statusField = employee.status?.trim().toLowerCase();
  
  // CRITICAL: If status field shows a non-active status, prioritize it
  // This ensures filter matches display
  if (statusField && statusField !== '' && statusField !== 'active') {
    return statusField;
  }
  
  // If status field is 'active' or null, use employee_status_name if available
  if (statusName && statusName !== '') {
    return statusName;
  }
  
  // If status field exists, use it
  if (statusField && statusField !== '') {
    return statusField;
  }
  
  // Default to 'active'
  return 'active';
};

/**
 * Resolve payroll status from canonical source:
 * 1) employee_statuses.name (joined as employee_status_name)
 * 2) employees.status
 * 3) empty string when both are missing
 *
 * Note:
 * - We intentionally do NOT default to 'active' here.
 * - Payroll eligibility should be explicit and deterministic.
 */
export const getCanonicalPayrollStatus = (employee: {
  employee_status_name?: string | null;
  status?: string | null;
}): string => {
  const statusFromRelation = employee.employee_status_name?.trim().toLowerCase();
  const statusFromField = employee.status?.trim().toLowerCase();

  if (statusFromRelation) return statusFromRelation;
  if (statusFromField) return statusFromField;
  return '';
};

/**
 * Payroll eligibility rule:
 * - Include: active, probation
 * - Exclude: terminated/inactive/resigned/pending removal and unknown status
 */
export const isEmployeeEligibleForPayroll = (employee: {
  employee_status_name?: string | null;
  status?: string | null;
  pending_removal?: boolean | null;
}): boolean => {
  if (employee.pending_removal === true) return false;

  const canonicalStatus = getCanonicalPayrollStatus(employee);
  return canonicalStatus === 'active' || canonicalStatus === 'probation';
};

/**
 * Filter employees based on multiple criteria
 */
export interface EmployeeFilters {
  search?: string;
  department?: string;
  position?: string;
  status?: string;
  employmentType?: string;
  timePeriod?: string;
}

export const filterEmployees = (
  employees: Employee[],
  filters: EmployeeFilters
): Employee[] => {
  return employees.filter(emp => {
    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch = 
        emp.full_name?.toLowerCase().includes(searchLower) ||
        emp.email?.toLowerCase().includes(searchLower) ||
        emp.employee_id?.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Department filter - case-insensitive matching
    if (filters.department && filters.department !== 'all') {
      const empDept = emp.department_name?.toLowerCase().trim();
      const filterDept = filters.department.toLowerCase().trim();
      if (empDept !== filterDept) {
        return false;
      }
    }

    // Position filter - case-insensitive matching
    if (filters.position && filters.position !== 'all') {
      const empPos = emp.job_position_name?.toLowerCase().trim();
      const filterPos = filters.position.toLowerCase().trim();
      if (empPos !== filterPos) {
        return false;
      }
    }

    // Status filter - use consistent logic
    if (filters.status && filters.status !== 'all') {
      const filterStatus = filters.status.toLowerCase();
      
      // If filtering for active, exclude pending_removal employees
      if (filterStatus === 'active') {
        if (emp.pending_removal === true) {
          return false;
        }
        // Check if status is actually active
        const empStatus = getEmployeeStatusForFilter(emp);
        if (empStatus !== 'active') {
          return false;
        }
      }
      // If filtering for pending removal
      else if (filterStatus === 'pending-removal' || filterStatus === 'pending removal') {
        if (emp.pending_removal !== true) {
          return false;
        }
      } else {
        // For other status filters, use normal logic
        const empStatus = getEmployeeStatusForFilter(emp);
        if (empStatus !== filterStatus) {
          return false;
        }
      }
    }

    // Employment type filter (if we have this field)
    // Note: This might need to be added to Employee type if not exists
    if (filters.employmentType && filters.employmentType !== 'all') {
      // Implement when employment type field is available
    }

    // Time period filter
    if (filters.timePeriod && filters.timePeriod !== 'all' && emp.join_date) {
      const joinDate = new Date(emp.join_date);
      const now = new Date();
      
      switch (filters.timePeriod) {
        case 'this_week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (joinDate < weekAgo) return false;
          break;
        case 'this_month':
          if (joinDate.getMonth() !== now.getMonth() || joinDate.getFullYear() !== now.getFullYear()) {
            return false;
          }
          break;
        case 'last_month':
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1);
          if (joinDate.getMonth() !== lastMonth.getMonth() || joinDate.getFullYear() !== lastMonth.getFullYear()) {
            return false;
          }
          break;
        case 'last_3_months':
          const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          if (joinDate < threeMonthsAgo) return false;
          break;
        case 'last_6_months':
          const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
          if (joinDate < sixMonthsAgo) return false;
          break;
        case 'this_year':
          if (joinDate.getFullYear() !== now.getFullYear()) return false;
          break;
        case 'last_year':
          if (joinDate.getFullYear() !== now.getFullYear() - 1) return false;
          break;
      }
    }

    return true;
  });
};

/**
 * Count active employees - consistent with subscription overview
 */
export const countActiveEmployees = (employees: Employee[]): number => {
  return employees.filter(isEmployeeActive).length;
};

