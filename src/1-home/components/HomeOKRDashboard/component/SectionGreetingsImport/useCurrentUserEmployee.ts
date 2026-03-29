
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useAuthSession } from '@/shared/hooks/useAuthSession';
import { useCurrentOrg } from '../../hooks/useCurrentOrg';

const isDev = import.meta.env.DEV;
const shouldLog = isDev && Math.random() < 0.02; // Only log 2% in dev

export const useCurrentUserEmployee = () => {
  const { user } = useAuthSession();
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ['current-user-employee', user?.id, organizationId],
    queryFn: async () => {
      if (!user?.id || !organizationId) {
        return null;
      }

      const { data: rawEmployee, error: employeeError } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', user.id)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (employeeError) {
        console.error('❌ Error fetching employee:', employeeError);
        throw employeeError;
      }

      if (!rawEmployee) {
        return null;
      }

      const statusRes = rawEmployee.employee_status_id
        ? await supabase
            .from('employee_statuses')
            .select('name')
            .eq('id', rawEmployee.employee_status_id)
            .maybeSingle()
        : { data: null };

      const employee = {
        ...rawEmployee,
        employee_statuses: statusRes.data ? { name: statusRes.data.name } : null,
      };

      const statusName = String(employee.employee_statuses?.name || 'active').toLowerCase();
      const isEligibleStatus = statusName === 'active' || statusName === 'probation';
      if (!isEligibleStatus || employee.pending_removal === true) {
        return null;
      }

      // Get related data
      const [departmentData, jobPositionData, profileData] = await Promise.all([
        rawEmployee.department_id
          ? supabase
              .from('departments')
              .select('name')
              .eq('id', rawEmployee.department_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        rawEmployee.job_position_id
          ? supabase
              .from('job_positions')
              .select('name')
              .eq('id', rawEmployee.job_position_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', user.id)
          .maybeSingle()
      ]);

      const result = {
        ...employee,
        department_name: departmentData.data?.name || null,
        job_position_name: jobPositionData.data?.name || null,
        profile_name: profileData.data?.full_name || rawEmployee.full_name || 'User',
        profile_photo_url: rawEmployee.profile_photo_url,
      };

      if (shouldLog) {
        console.log('✅ useCurrentUserEmployee:', result.full_name, 'in', result.department_name);
      }
      
      return result;
    },
    enabled: !!user?.id && !!organizationId,
    staleTime: 30 * 1000, // 30 seconds - much shorter for debugging
    gcTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: false, // Tidak refetch saat pindah tab/window
  });
};
