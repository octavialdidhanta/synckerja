import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/components/ui/use-toast';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';
import { logger } from '@/shared/lib/logger';

export interface EmployeeStatus {
  id: string;
  employee_id: string;
  organization_id: string;
  status_text: string;
  location: string;
  status_type: 'work' | 'meeting' | 'break' | 'call' | 'wfh';
  created_at: string;
  expires_at: string;
  employees?: {
    full_name: string;
    user_id?: string | null;
    profile_photo_url?: string | null;
    departments?: {
      name: string;
    } | null;
  } | null;
}

export const EMPLOYEE_STATUS_LIST_QUERY_KEY = 'employee-status-list';

async function fetchEmployeeStatuses(organizationId: string): Promise<EmployeeStatus[]> {
  logger.query('Fetching employee statuses for organization:', organizationId);

  const { data, error } = await supabase
    .from('employee_status')
    .select(`
      *,
      employees!inner (
        full_name,
        organization_id,
        user_id,
        profile_photo_url,
        departments (
          name
        )
      )
    `)
    .eq('employees.organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data as unknown as EmployeeStatus[]) || [];

  const userIds = [
    ...new Set(
      rows
        .map((s) => s.employees?.user_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  if (userIds.length === 0) {
    return rows;
  }

  const { data: detailsRows } = await supabase
    .from('user_profile_details')
    .select('profile_id, profile_photo_url')
    .in('profile_id', userIds);

  const photoByUser = new Map(
    (detailsRows ?? []).map((d) => [d.profile_id, d.profile_photo_url]),
  );

  return rows.map((status) => {
    const emp = status.employees;
    if (!emp) return status;
    const detailPhoto = emp.user_id ? photoByUser.get(emp.user_id) : null;
    const mergedPhoto = emp.profile_photo_url || detailPhoto || null;
    return {
      ...status,
      employees: { ...emp, profile_photo_url: mergedPhoto },
    };
  });
}

export const useEmployeeStatus = () => {
  const { toast } = useToast();
  const { organizationId } = useCurrentOrg();
  const { employee } = useCentralizedUserData();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const {
    data: statuses = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: [EMPLOYEE_STATUS_LIST_QUERY_KEY, organizationId],
    queryFn: () => fetchEmployeeStatuses(organizationId!),
    enabled: !!organizationId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const loadError = queryError instanceof Error ? queryError : queryError ? new Error(String(queryError)) : null;

  const invalidateStatuses = useCallback(() => {
    if (organizationId) {
      void queryClient.invalidateQueries({
        queryKey: [EMPLOYEE_STATUS_LIST_QUERY_KEY, organizationId],
      });
    }
  }, [organizationId, queryClient]);

  const createStatus = async (statusData: {
    status_text: string;
    location: string;
    status_type: 'work' | 'meeting' | 'break' | 'call' | 'wfh';
  }) => {
    try {
      const employeeId = employee?.id;
      if (!employeeId || !organizationId) {
        toast({
          title: 'Info',
          description: t('home.employeeStatus.notAvailable'),
          variant: 'default',
        });
        return false;
      }

      const { error } = await supabase.from('employee_status').insert([
        {
          ...statusData,
          employee_id: employeeId,
          organization_id: organizationId,
        },
      ]);

      if (error) {
        console.error('Error creating status:', error);
        toast({
          title: 'Error',
          description: t('home.employeeStatus.createError'),
          variant: 'destructive',
        });
        return false;
      }

      toast({
        title: 'Berhasil',
        description: t('home.employeeStatus.createSuccess'),
      });

      invalidateStatuses();
      return true;
    } catch (error) {
      console.error('Error creating status:', error);
      toast({
        title: 'Error',
        description: t('home.employeeStatus.createErrorGeneric'),
        variant: 'destructive',
      });
      return false;
    }
  };

  const updateStatus = async (
    statusId: string,
    statusData: {
      status_text: string;
      location: string;
      status_type: 'work' | 'meeting' | 'break' | 'call' | 'wfh';
    },
  ) => {
    try {
      const { error } = await supabase.from('employee_status').update(statusData).eq('id', statusId);

      if (error) {
        console.error('Error updating status:', error);
        toast({
          title: 'Error',
          description: t('home.employeeStatus.updateError'),
          variant: 'destructive',
        });
        return false;
      }

      toast({
        title: 'Berhasil',
        description: t('home.employeeStatus.updateSuccess'),
      });

      invalidateStatuses();
      return true;
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: 'Error',
        description: t('home.employeeStatus.updateErrorGeneric'),
        variant: 'destructive',
      });
      return false;
    }
  };

  const deleteStatus = async (statusId: string) => {
    try {
      const { error } = await supabase.from('employee_status').delete().eq('id', statusId);

      if (error) {
        console.error('Error deleting status:', error);
        toast({
          title: 'Error',
          description: t('home.employeeStatus.deleteError'),
          variant: 'destructive',
        });
        return false;
      }

      toast({
        title: 'Berhasil',
        description: t('home.employeeStatus.deleteSuccess'),
      });

      invalidateStatuses();
      return true;
    } catch (error) {
      console.error('Error deleting status:', error);
      toast({
        title: 'Error',
        description: t('home.employeeStatus.deleteErrorGeneric'),
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    statuses,
    loading,
    error: loadError,
    createStatus,
    updateStatus,
    deleteStatus,
    refetch,
  };
};
