import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { devLog } from '@/shared/lib/logger';
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

export interface ApprovalAccess {
  approved: boolean;
  prodApproved: boolean;
  revision: boolean;
  productionRevision: boolean;
  loading: boolean;
}

type ColumnType = 'approved' | 'prod_approved' | 'revision' | 'production_revision';

interface ApprovalConfigRow {
  column_type: string;
  is_active: boolean;
  allowed_roles?: string[] | null;
  exceptions?: string[] | null;
}

function computeColumnAccess(
  columnType: ColumnType,
  userRole: string,
  employeeId: string | undefined,
  config: ApprovalConfigRow | undefined,
): boolean {
  const isRevisionType = columnType === 'revision' || columnType === 'production_revision';

  if (isRevisionType && config && !config.is_active) {
    return false;
  }

  const effectiveConfig = config?.is_active ? config : undefined;

  if (!effectiveConfig) {
    return userRole === 'owner' || userRole === 'admin';
  }

  const hasRoleAccess = effectiveConfig.allowed_roles?.includes(userRole) ?? false;
  const isException = employeeId ? (effectiveConfig.exceptions?.includes(employeeId) ?? false) : false;
  return hasRoleAccess || isException;
}

const EMPTY_ACCESS = {
  approved: false,
  prodApproved: false,
  revision: false,
  productionRevision: false,
};

/**
 * Resolves approval column access from org configs only.
 * User role + employee id come from CentralizedUserData (no duplicate getUser/profiles/user_roles).
 */
export const useBatchApprovalAccess = (): ApprovalAccess => {
  const { user, userRole, employee, loading: centralLoading, centralProfileHydrated } =
    useCentralizedUserData();
  const { organizationId } = useCurrentOrg();

  const employeeId = employee?.id;
  const roleKey = userRole ?? 'none';

  const query = useQuery({
    queryKey: ['batch-approval-access', user?.id, organizationId, roleKey, employeeId],
    queryFn: async () => {
      if (!organizationId || !userRole) return EMPTY_ACCESS;

      try {
        const { data: configs, error } = await supabase
          .from('approval_access_configurations')
          .select('column_type, is_active, allowed_roles, exceptions')
          .eq('organization_id', organizationId)
          .in('column_type', ['approved', 'prod_approved', 'revision', 'production_revision']);

        if (error) {
          devLog.error('Error fetching approval access configurations:', error);
          return EMPTY_ACCESS;
        }

        const configsByType = new Map<string, ApprovalConfigRow>();
        for (const row of configs ?? []) {
          configsByType.set(row.column_type, row as ApprovalConfigRow);
        }

        return {
          approved: computeColumnAccess(
            'approved',
            userRole,
            employeeId,
            configsByType.get('approved'),
          ),
          prodApproved: computeColumnAccess(
            'prod_approved',
            userRole,
            employeeId,
            configsByType.get('prod_approved'),
          ),
          revision: computeColumnAccess('revision', userRole, employeeId, configsByType.get('revision')),
          productionRevision: computeColumnAccess(
            'production_revision',
            userRole,
            employeeId,
            configsByType.get('production_revision'),
          ),
        };
      } catch (error) {
        devLog.error('Error fetching batch approval access:', error);
        return EMPTY_ACCESS;
      }
    },
    enabled: centralProfileHydrated && !!organizationId && !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  });

  const data = query.data ?? EMPTY_ACCESS;
  const contextPending = centralLoading || !centralProfileHydrated;

  return {
    ...data,
    loading: contextPending || query.isPending,
  };
};
