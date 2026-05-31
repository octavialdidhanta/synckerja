import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { logger } from '@/shared/lib/logger';
import { pickHighestUserRoleFromRows } from '@/shared/lib/organizationRolePick';

export interface ProfileMyWorkData {
  employee_id?: string;
  organization_name?: string;
  branch_name?: string;
  department_name?: string;
  job_position_name?: string;
  job_level_name?: string;
  organization_role?: string;
  employment_status?: string;
  join_date?: string;
  direct_manager_name?: string;
}

const MY_WORK_SELECT = `
  employee_id,
  join_date,
  manager_id,
  user_id,
  status,
  organization_id,
  branch_id,
  departments(name),
  job_positions(name),
  job_levels(name),
  employee_statuses(name)
`;

function toDisplayString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return text || undefined;
}

async function fetchMyWorkInfo(
  employeeId: string,
  organizationId: string,
  userId: string | null,
): Promise<ProfileMyWorkData | null> {
  try {
    const { data: employee, error } = await supabase
      .from('employees')
      .select(MY_WORK_SELECT)
      .eq('id', employeeId)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (error) {
      logger.warn('Error fetching my work info:', error);
      return null;
    }

    if (!employee) return null;

    const managerId = employee.manager_id as string | null | undefined;
    const branchId = employee.branch_id as string | null | undefined;
    const resolvedUserId = (employee.user_id as string | null | undefined) ?? userId;
    const orgId = (employee.organization_id as string | null | undefined) ?? organizationId;

    const [managerResult, roleResult, orgResult, branchResult] = await Promise.all([
      managerId
        ? supabase.from('employees').select('full_name').eq('id', managerId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      resolvedUserId
        ? supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', resolvedUserId)
            .eq('organization_id', organizationId)
        : Promise.resolve({ data: null, error: null }),
      orgId
        ? supabase.from('organizations').select('company_name').eq('id', orgId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      branchId
        ? supabase.from('branches').select('name').eq('id', branchId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (managerResult.error) {
      logger.warn('Error fetching direct manager:', managerResult.error);
    }
    if (roleResult.error) {
      logger.warn('Error fetching organization role:', roleResult.error);
    }
    if (orgResult.error) {
      logger.warn('Error fetching organization name:', orgResult.error);
    }
    if (branchResult.error) {
      logger.warn('Error fetching branch name:', branchResult.error);
    }

    const departments = employee.departments as { name?: string } | null;
    const jobPositions = employee.job_positions as { name?: string } | null;
    const jobLevels = employee.job_levels as { name?: string } | null;
    const employeeStatuses = employee.employee_statuses as { name?: string } | null;

    const statusFromMaster = employeeStatuses?.name?.trim();
    const statusFallback = (employee.status as string | null | undefined)?.trim();
    const organizationRole = roleResult.data?.length
      ? pickHighestUserRoleFromRows(roleResult.data)
      : null;

    return {
      employee_id: toDisplayString(employee.employee_id),
      organization_name: orgResult.data?.company_name?.trim() || undefined,
      branch_name: branchResult.data?.name?.trim() || undefined,
      department_name: departments?.name?.trim() || undefined,
      job_position_name: jobPositions?.name?.trim() || undefined,
      job_level_name: jobLevels?.name?.trim() || undefined,
      organization_role: organizationRole ?? undefined,
      employment_status: statusFromMaster || statusFallback || undefined,
      join_date: (employee.join_date as string | null | undefined) ?? undefined,
      direct_manager_name: managerResult.data?.full_name?.trim() || undefined,
    };
  } catch (err) {
    logger.warn('Failed to fetch my work info:', err);
    return null;
  }
}

export function useProfileMyWork(
  employeeId: string | null,
  organizationId: string | null,
  userId: string | null,
  enabled: boolean,
) {
  const [myWorkInfo, setMyWorkInfo] = useState<ProfileMyWorkData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (!employeeId || !organizationId) {
      setMyWorkInfo(null);
      return;
    }

    cancelledRef.current = false;
    setLoading(true);
    setError(null);

    try {
      const result = await fetchMyWorkInfo(employeeId, organizationId, userId);

      if (cancelledRef.current) return;

      setMyWorkInfo(result);
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch my work info');
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [employeeId, organizationId, userId]);

  useEffect(() => {
    if (!enabled) {
      cancelledRef.current = true;
      return;
    }

    void fetchData();

    return () => {
      cancelledRef.current = true;
    };
  }, [enabled, fetchData]);

  return {
    myWorkInfo,
    loading,
    error,
    refetch: fetchData,
  };
}
