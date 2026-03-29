import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { isEmployeeActive } from '@/2-1-employees/utils/employeeUtils';
import { Department } from './departmentTypes';

function statusNameFromJoin(row: {
  employee_statuses?: { name?: string } | { name?: string }[] | null;
}) {
  const es = row.employee_statuses;
  if (!es) return null;
  if (Array.isArray(es)) return es[0]?.name ?? null;
  return es.name ?? null;
}

export const useDepartments = (organizationId?: string) => {
  const { data: departments = [], isLoading, error, refetch } = useQuery({
    queryKey: ['departments', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      // console.log('🔍 useDepartments: Fetching departments for org:', organizationId);
      
      // First, get departments directly from departments table for this organization
      const { data: orgDepartments, error: orgDeptError } = await supabase
        .from('departments')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name');

      if (orgDeptError) {
        console.error('❌ useDepartments: Error fetching org departments:', orgDeptError);
      }

      // console.log('✅ useDepartments: Org departments:', orgDepartments?.length || 0);

      // Second, get ALL employees for this organization to see what departments they use
      const { data: allEmployees, error: empError } = await supabase
        .from('employees')
        .select('department_id, full_name')
        .eq('organization_id', organizationId);

      if (empError) {
        console.error('❌ useDepartments: Error fetching employees:', empError);
      } else {
        // console.log('📊 useDepartments: All employees in org:', allEmployees?.length || 0);
      }

      // Third, get departments used by active employees (even if department.organization_id is NULL)
      const { data: employeeDepartmentsRaw, error: empDeptError } = await supabase
        .from('employees')
        .select(`
          department_id,
          full_name,
          pending_removal,
          employee_statuses!left(name),
          departments!inner(
            id,
            name,
            organization_id,
            is_active,
            code,
            description,
            created_at,
            updated_at
          )
        `)
        .eq('organization_id', organizationId)
        .not('department_id', 'is', null);

      if (empDeptError) {
        console.error('❌ useDepartments: Error fetching employee departments:', empDeptError);
      }

      const employeeDepartments = (employeeDepartmentsRaw ?? []).filter((emp) =>
        isEmployeeActive({
          employee_status_name: statusNameFromJoin(emp),
          status: null,
          pending_removal: emp.pending_removal,
        })
      );

      // console.log('✅ useDepartments: Employee department relations:', employeeDepartments?.length || 0);

      // Extract department data from employee relations
      const empDepts = employeeDepartments.map((emp) => emp.departments).filter(Boolean);
      // console.log('✅ useDepartments: Extracted employee departments:', empDepts.length);

      // Combine and deduplicate departments
      const allDepartments = [...(orgDepartments || [])];
      
      // Add departments from employees that aren't already in the list
      empDepts.forEach(empDept => {
        if (!allDepartments.find(d => d.id === empDept.id)) {
          // console.log('➕ Adding department from employees:', empDept.name, 'org_id:', empDept.organization_id);
          // Only include properties that match the Department type
          allDepartments.push({
            id: empDept.id,
            name: empDept.name,
            organization_id: empDept.organization_id,
            is_active: empDept.is_active,
            code: empDept.code,
            description: empDept.description,
            created_at: empDept.created_at,
            updated_at: empDept.updated_at,
            created_by: undefined,
            is_default: false
          });
        }
      });

      // Filter active departments and sort by name
      const activeDepartments = allDepartments
        .filter(dept => dept.is_active !== false)
        .sort((a, b) => a.name.localeCompare(b.name));
      
      // console.log('🟢 useDepartments: Final active departments count:', activeDepartments.length);
      
      return activeDepartments as Department[];
    },
    enabled: !!organizationId,
  });

  return {
    departments,
    isLoading,
    error,
    refetch,
  };
};
