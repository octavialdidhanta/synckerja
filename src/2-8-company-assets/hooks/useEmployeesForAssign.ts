import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

export interface EmployeeOption {
  id: string;
  full_name: string;
  department_id: string | null;
  department_name: string | null;
}

export function useEmployeesForAssign() {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ['employees-for-assign', organizationId],
    queryFn: async (): Promise<EmployeeOption[]> => {
      if (!organizationId) return [];
      const { data: emps, error } = await supabase
        .from('employees')
        .select('id, full_name, department_id')
        .eq('organization_id', organizationId)
        .order('full_name');

      if (error) throw error;
      if (!emps?.length) return [];

      const deptIds = [...new Set(emps.map((e) => e.department_id).filter(Boolean))] as string[];
      let deptMap: Record<string, string> = {};
      if (deptIds.length > 0) {
        const { data: depts } = await supabase.from('departments').select('id, name').in('id', deptIds);
        deptMap = (depts || []).reduce((acc, d) => ({ ...acc, [d.id]: d.name }), {});
      }

      return emps.map((e) => ({
        id: e.id,
        full_name: e.full_name,
        department_id: e.department_id ?? null,
        department_name: e.department_id ? deptMap[e.department_id] ?? null : null,
      }));
    },
    enabled: !!organizationId,
  });
}
