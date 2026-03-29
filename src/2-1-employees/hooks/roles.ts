/**
 * Employee Role Constants
 * Centralized role definitions for consistent usage across the application
 */

export const EMPLOYEE_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  HR: 'hr',
  EMPLOYEE: 'employee',
  MANAGER: 'manager',
} as const;

export type EmployeeRole = typeof EMPLOYEE_ROLES[keyof typeof EMPLOYEE_ROLES];

/**
 * Check if a role has admin privileges
 */
export const hasAdminPrivileges = (role?: string): boolean => {
  return role === EMPLOYEE_ROLES.OWNER || role === EMPLOYEE_ROLES.ADMIN;
};

/**
 * Check if a role can view/edit employees
 */
export const canManageEmployees = (role?: string): boolean => {
  return role === EMPLOYEE_ROLES.OWNER || 
         role === EMPLOYEE_ROLES.ADMIN || 
         role === EMPLOYEE_ROLES.HR;
};

/**
 * Check if a role is owner
 */
export const isOwnerRole = (role?: string): boolean => {
  return role === EMPLOYEE_ROLES.OWNER;
};

