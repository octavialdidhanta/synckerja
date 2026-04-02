import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useEmployees } from '@/2-1-employees/hooks/useEmployees';
import { isEmployeeInOrganizationalStructure } from '@/2-1-employees/utils/employeeUtils';

export const useOrganizationalStructure = () => {
  const { organizationId } = useCurrentOrg();
  const { data: allEmployees = [], isLoading: employeesLoading } = useEmployees();

  // Exclude only resigned/terminated/inactive/pending removal; include active, probation, contract, etc.
  const employees = useMemo(
    () => allEmployees.filter(isEmployeeInOrganizationalStructure),
    [allEmployees]
  );

  // Fetch departments
  const { data: departments = [], isLoading: departmentsLoading } = useQuery({
    queryKey: ['departments', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name');
      
      if (error) {
        console.error('Error fetching departments:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!organizationId,
  });

  // Fetch job positions
  const { data: jobPositions = [], isLoading: positionsLoading } = useQuery({
    queryKey: ['job-positions', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('job_positions')
        .select('id, name')
        .eq('is_active', true);
      
      if (error) {
        console.error('Error fetching job positions:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!organizationId,
  });

  // Calculate statistics
  const statistics = useMemo(() => {
    // Total employees
    const totalEmployees = employees.length;

    // Total departments (unique department IDs from employees)
    const uniqueDepartmentIds = new Set(
      employees
        .map(emp => emp.department_id)
        .filter(id => id !== null && id !== undefined)
    );
    const totalDepartments = Math.max(
      uniqueDepartmentIds.size,
      departments.length
    );

    // Total positions (unique job_position_id from employees)
    const uniquePositionIds = new Set(
      employees
        .map(emp => emp.job_position_id)
        .filter(id => id !== null && id !== undefined)
    );
    const totalPositions = Math.max(
      uniquePositionIds.size,
      jobPositions.length
    );

    // Executive count (employees with executive-level job levels)
    const executiveCount = employees.filter(emp => {
      const jobLevelName = (emp.job_level_name || '').toLowerCase();
      return jobLevelName.includes('executive') || jobLevelName.includes('eksekutif');
    }).length;

    return {
      totalEmployees,
      totalDepartments,
      totalPositions,
      executiveCount,
    };
  }, [employees, departments, jobPositions]);

  const isLoading = employeesLoading || departmentsLoading || positionsLoading;

  return {
    statistics,
    isLoading,
    error: null,
    data: employees, // Keep for backward compatibility
  };
};