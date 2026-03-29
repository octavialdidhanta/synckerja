import { useMemo } from 'react';
import { Employee } from './useEmployees';
import { hasAdminPrivileges, canManageEmployees, isOwnerRole } from './roles';

interface UseEmployeePermissionsParams {
  employee: Employee;
  userRole?: string;
  currentUserEmail?: string;
}

interface EmployeePermissions {
  canView: boolean;
  canEdit: boolean;
  canResign: boolean;
  canDelete: boolean;
  isSelf: boolean;
  isOwner: boolean;
  reasons: {
    cannotResign?: string;
    cannotDelete?: string;
    cannotEdit?: string;
  };
}

/**
 * Hook to determine employee action permissions
 * Centralizes all permission logic in one place
 */
export const useEmployeePermissions = ({
  employee,
  userRole,
  currentUserEmail
}: UseEmployeePermissionsParams): EmployeePermissions => {
  return useMemo(() => {
    const isSelf = employee.email === currentUserEmail;
    const isEmployeeOwner = employee.is_organization_owner;

    // Base permissions
    const canView = true; // Everyone can view
    const canEdit = canManageEmployees(userRole);
    
    // Resign permissions
    const canResignRole = hasAdminPrivileges(userRole);
    const canResign = canResignRole && !isEmployeeOwner && !isSelf;
    
    // Delete permissions
    const canDelete = isOwnerRole(userRole) && !isEmployeeOwner && !isSelf;

    // Reasons for denied permissions
    const reasons: EmployeePermissions['reasons'] = {};
    
    if (!canResign) {
      if (isEmployeeOwner) {
        reasons.cannotResign = "Organization owners cannot be resigned. Transfer ownership first if needed.";
      } else if (isSelf) {
        reasons.cannotResign = "You cannot resign yourself. Please contact another admin or the organization owner.";
      } else if (!canResignRole) {
        reasons.cannotResign = "You do not have permission to resign employees.";
      }
    }

    if (!canDelete) {
      if (isEmployeeOwner) {
        reasons.cannotDelete = "Organization owners cannot be deleted from the employee list.";
      } else if (isSelf) {
        reasons.cannotDelete = "You cannot delete your own employee record.";
      } else if (!isOwnerRole(userRole)) {
        reasons.cannotDelete = "Only organization owners can delete employees.";
      }
    }

    if (!canEdit && !canManageEmployees(userRole)) {
      reasons.cannotEdit = "You do not have permission to edit employee information.";
    }

    return {
      canView,
      canEdit,
      canResign,
      canDelete,
      isSelf,
      isOwner: isEmployeeOwner,
      reasons
    };
  }, [employee, userRole, currentUserEmail]);
};

