import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';

/**
 * ENHANCED ROLE VALIDATOR (Database-Only Access Control)
 * Role validation for Page Access Configuration with database-first approach
 * Access control determined by database configuration, not hardcoded restrictions
 * Default: Allow authenticated users unless restricted in database
 */

// DATABASE-ONLY ACCESS CONTROL: Allow all authenticated roles by default
// Access restrictions should be configured in the database only
const PAGE_ACCESS_WHITELIST = Object.freeze([
  'owner',
  'admin',
  'employee',
  'hr'
] as const);

// MINIMAL BLACKLIST: Only clearly unauthorized roles are denied  
const PAGE_ACCESS_BLACKLIST = Object.freeze([
  'guest',
  'viewer',
  'readonly'
] as const);

type WhitelistedRole = typeof PAGE_ACCESS_WHITELIST[number];
type BlacklistedRole = typeof PAGE_ACCESS_BLACKLIST[number];

interface RoleValidationResult {
  isValid: boolean;
  role: string;
  reason: string;
  securityLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  recommendedAction: string;
}

/**
 * Enhanced role validation with multiple security layers
 */
export const validateRoleForPageAccess = (
  userRole: string | null,
  isOwner: boolean,
  isAdmin: boolean,
  userData: any,
  employee: any
): RoleValidationResult => {
  
  // OWNER OVERRIDE: If isOwner is true, immediately grant access regardless of other factors
  if (isOwner || userRole === 'owner') {
    return {
      isValid: true,
      role: userRole || 'owner',
      reason: 'Owner access override - full permissions granted',
      securityLevel: 'LOW',
      recommendedAction: 'Continue with full access'
    };
  }
  
  // Layer 1: Null/undefined check
  if (!userRole || userRole === null || userRole === undefined) {
    return {
      isValid: false,
      role: 'null',
      reason: 'Role is null or undefined',
      securityLevel: 'CRITICAL',
      recommendedAction: 'Immediate logout and re-authentication required'
    };
  }

  // Layer 2: Empty string check
  if (typeof userRole !== 'string' || userRole.trim() === '') {
    return {
      isValid: false,
      role: userRole.toString(),
      reason: 'Role is empty or not a valid string',
      securityLevel: 'CRITICAL', 
      recommendedAction: 'Force logout - Invalid role data'
    };
  }

  const normalizedRole = userRole.toLowerCase().trim();

  // Layer 3: Blacklist validation (only clearly unauthorized roles)
  if (PAGE_ACCESS_BLACKLIST.includes(normalizedRole as BlacklistedRole)) {
    return {
      isValid: false,
      role: normalizedRole,
      reason: `Role '${normalizedRole}' is unauthorized (guest/readonly roles not allowed)`,
      securityLevel: 'HIGH',
      recommendedAction: 'Redirect to authorized pages only'
    };
  }

  // Layer 4: Whitelist validation (all authenticated roles allowed by default)
  if (!PAGE_ACCESS_WHITELIST.includes(normalizedRole as WhitelistedRole)) {
    return {
      isValid: false,
      role: normalizedRole,
      reason: `Role '${normalizedRole}' is not recognized as a valid authenticated role`,
      securityLevel: 'HIGH',
      recommendedAction: 'Role verification required - ensure valid role assignment'
    };
  }

  // Layer 5: Cross-reference with boolean flags
  if (normalizedRole === 'owner' && !isOwner) {
    return {
      isValid: false,
      role: normalizedRole,
      reason: 'Role is "owner" but isOwner flag is false - data inconsistency',
      securityLevel: 'CRITICAL',
      recommendedAction: 'Data integrity check required - Force re-authentication'
    };
  }

  if (normalizedRole === 'admin' && !isAdmin && !isOwner) {
    return {
      isValid: false,
      role: normalizedRole,
      reason: 'Role is "admin" but neither isAdmin nor isOwner flags are true',
      securityLevel: 'CRITICAL',
      recommendedAction: 'Permission escalation detected - Security audit required'
    };
  }

  // Layer 6: User data consistency check (RELAXED FOR OWNER)
  if (!userData) {
    return {
      isValid: false,
      role: normalizedRole,
      reason: 'Missing user data context',
      securityLevel: 'HIGH',
      recommendedAction: 'Re-fetch user data and validate session'
    };
  }

  // For owner: userData.id is not strictly required (owner might not have complete employee record)
  if (normalizedRole !== 'owner' && !userData.id) {
    return {
      isValid: false,
      role: normalizedRole,
      reason: 'Valid role but missing user data ID',
      securityLevel: 'MEDIUM',
      recommendedAction: 'Complete user profile setup'
    };
  }

  // Layer 7: Employee data consistency (for admin role only)
  if (normalizedRole === 'admin' && (!employee || !employee.id)) {
    return {
      isValid: false,
      role: normalizedRole,
      reason: 'Admin role requires valid employee context',
      securityLevel: 'MEDIUM',
      recommendedAction: 'Validate employee profile completion'
    };
  }

  // All validations passed
  return {
    isValid: true,
    role: normalizedRole,
    reason: 'Role validation successful - access granted',
    securityLevel: 'LOW',
    recommendedAction: 'Continue with authorized access'
  };
};

/**
 * Hook for using role validation in components
 */
export const useEnhancedRoleValidation = () => {
  const { userRole, isOwner, isAdmin, userData, employee } = useCentralizedUserData();
  
  const validateCurrentRole = (): RoleValidationResult => {
    return validateRoleForPageAccess(userRole, isOwner, isAdmin, userData, employee);
  };

  const isAuthorizedForPageAccess = (): boolean => {
    const validation = validateCurrentRole();
    return validation.isValid;
  };

  const getValidationDetails = (): RoleValidationResult => {
    return validateCurrentRole();
  };

  // Quick security check
  const performSecurityCheck = (): {
    passed: boolean;
    alerts: string[];
    recommendations: string[];
  } => {
    const validation = validateCurrentRole();
    
    const alerts: string[] = [];
    const recommendations: string[] = [];

    if (!validation.isValid) {
      alerts.push(`Security Alert: ${validation.reason}`);
      recommendations.push(validation.recommendedAction);
    }

    // Additional security checks
    if (userRole && userRole.includes(' ')) {
      alerts.push('Role contains spaces - potential injection attempt');
      recommendations.push('Sanitize role data');
    }

    if (userRole && userRole.length > 20) {
      alerts.push('Role name unusually long - potential attack vector');
      recommendations.push('Validate role name format');
    }

    return {
      passed: validation.isValid && alerts.length === 0,
      alerts,
      recommendations
    };
  };

  return {
    validateCurrentRole,
    isAuthorizedForPageAccess,
    getValidationDetails,
    performSecurityCheck,
    // Direct access to validation constants
    whitelist: PAGE_ACCESS_WHITELIST,
    blacklist: PAGE_ACCESS_BLACKLIST
  };
};
