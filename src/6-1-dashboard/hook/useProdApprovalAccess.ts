import { useState, useEffect } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { devLog } from '@/shared/lib/logger';

interface ProfileRow {
  active_organization_id: string | null;
}

interface UserRoleRow {
  role: string;
}

interface EmployeeRow {
  id: string;
}

interface ApprovalConfigRow {
  allowed_roles?: string[] | null;
  exceptions?: string[] | null;
}

/**
 * Shared hook for prod_approved approval access (owner/admin or approval_access_configurations).
 * Used by GoogleDriveLinkDialog (desktop Preview) and PublicContentReviewPage (Android review).
 */
export function useProdApprovalAccess(enabled: boolean): { canShowApprovalButtons: boolean; loading: boolean } {
  const [canShowApprovalButtons, setCanShowApprovalButtons] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setCanShowApprovalButtons(false);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const check = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) {
          if (!cancelled) setCanShowApprovalButtons(false);
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('active_organization_id')
          .eq('user_id', user.id)
          .single();

        const profile = profileData as unknown as ProfileRow | null;
        if (profileError || !profile?.active_organization_id || cancelled) {
          if (!cancelled) setCanShowApprovalButtons(false);
          return;
        }

        const orgId = profile.active_organization_id;

        const { data: userRoleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('organization_id', orgId)
          .single();

        const userRole = userRoleData as unknown as UserRoleRow | null;
        if (roleError || !userRole || cancelled) {
          if (!cancelled) setCanShowApprovalButtons(false);
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase chain causes TS "excessively deep" instantiation
        const employeeRaw = await (supabase as any)
          .from('employees')
          .select('id')
          .eq('user_id', user.id)
          .eq('organization_id', orgId)
          .single();

        const employeeData = employeeRaw?.data as EmployeeRow | null;
        const employeeError = employeeRaw?.error;
        const employee = employeeData;
        if (employeeError || !employee || cancelled) {
          if (!cancelled) setCanShowApprovalButtons(false);
          return;
        }

        const { data: configData, error: configError } = await supabase
          .from('approval_access_configurations')
          .select('allowed_roles, exceptions')
          .eq('organization_id', orgId)
          .eq('column_type', 'prod_approved')
          .eq('is_active', true)
          .maybeSingle();

        const config = configData as unknown as ApprovalConfigRow | null;
        if (cancelled) return;

        if (configError || !config) {
          devLog.debug('No prod_approved configuration found, falling back to admin access');
          if (!cancelled) setCanShowApprovalButtons(userRole.role === 'owner' || userRole.role === 'admin');
          return;
        }

        const hasRoleAccess = config.allowed_roles?.includes(userRole.role) ?? false;
        const isException = config.exceptions?.includes(employee.id) ?? false;

        devLog.debug('Prod approval access check:', {
          userRole: userRole.role,
          employeeId: employee.id,
          allowedRoles: config.allowed_roles,
          exceptions: config.exceptions,
          hasRoleAccess,
          isException,
          finalAccess: hasRoleAccess || isException,
        });

        if (!cancelled) setCanShowApprovalButtons(hasRoleAccess || isException);
      } catch (error) {
        devLog.error('Error checking approval access:', error);
        if (!cancelled) setCanShowApprovalButtons(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    setLoading(true);
    check();
    return () => { cancelled = true; };
  }, [enabled]);

  return { canShowApprovalButtons, loading };
}
