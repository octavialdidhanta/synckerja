
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { Employee } from './useEmployees';
import { usePerformanceMonitor } from '@/shared/hooks/usePerformanceMonitor';

export const useEmployeeDetail = (employeeId: string | null) => {
  const perf = usePerformanceMonitor('useEmployeeDetail');

  return useQuery({
    queryKey: ['employees-optimized', 'detail', employeeId],
    queryFn: async () => {
      if (!employeeId) throw new Error('Employee ID is required');

      perf.start('fetch-employee-detail');
      perf.log(`Fetching employee detail for ID: ${employeeId}`);

      // Step 1: Get basic employee data first (most critical)
      perf.start('fetch-basic-employee');
      const { data: employee, error } = await supabase
        .from('employees')
        .select('*')
        .eq('id', employeeId)
        .maybeSingle();

      if (error) {
        perf.log(`Error fetching employee: ${error.message}`);
        console.error('Error fetching employee:', error);
        throw new Error(`Failed to fetch employee: ${error.message}`);
      }

      if (!employee) {
        perf.log(`Employee not found for ID: ${employeeId}`);
        console.warn('Employee not found for ID:', employeeId);
        throw new Error('Employee not found');
      }
      
      perf.end('fetch-basic-employee');
      perf.log(`Basic employee data fetched: ${employee.full_name}`);

      // Step 2: Get only essential related data in parallel (reduced from 5 to 3 queries)
      perf.start('fetch-related-data');
      
      // Only fetch the most critical related data initially
      const essentialPromises = [];
      
      if (employee.department_id) {
        essentialPromises.push(
          supabase.from('departments').select('name').eq('id', employee.department_id).maybeSingle()
        );
      } else {
        essentialPromises.push(Promise.resolve({ data: null }));
      }
      
      if (employee.job_position_id) {
        essentialPromises.push(
          supabase.from('job_positions').select('name').eq('id', employee.job_position_id).maybeSingle()
        );
      } else {
        essentialPromises.push(Promise.resolve({ data: null }));
      }
      
      if (employee.employee_status_id) {
        essentialPromises.push(
          supabase.from('employee_statuses').select('name').eq('id', employee.employee_status_id).maybeSingle()
        );
      } else {
        essentialPromises.push(Promise.resolve({ data: null }));
      }

      const [departmentData, jobPositionData, employeeStatusData] = await Promise.all(essentialPromises);
      perf.end('fetch-related-data');

      // Step 3: Get less critical data in background (job_level and branch can be loaded later)
      const backgroundPromises = [];
      
      if (employee.job_level_id) {
        backgroundPromises.push(
          supabase.from('job_levels').select('name').eq('id', employee.job_level_id).maybeSingle()
        );
      } else {
        backgroundPromises.push(Promise.resolve({ data: null }));
      }
      
      if (employee.branch_id) {
        backgroundPromises.push(
          supabase.from('branches').select('name').eq('id', employee.branch_id).maybeSingle()
        );
      } else {
        backgroundPromises.push(Promise.resolve({ data: null }));
      }

      // Don't await background data - let it load asynchronously
      Promise.all(backgroundPromises).then(([jobLevelData, branchData]) => {
        perf.log('Background data loaded for job_level and branch');
      }).catch(error => {
        console.warn('Background data loading failed:', error);
      });

      // For now, provide immediate response with essential data
      const [jobLevelData, branchData] = await Promise.all(backgroundPromises);

      // Transform the data with proper null handling
      const enrichedEmployee: Employee = {
        ...employee,
        department_name: departmentData.data?.name || null,
        job_position_name: jobPositionData.data?.name || null,
        job_level_name: jobLevelData.data?.name || null,
        branch_name: branchData.data?.name || null,
        employee_status_name: employeeStatusData.data?.name || employee.status || null,
      };

      perf.end('fetch-employee-detail');
      perf.log(`Employee detail fetched successfully: ${enrichedEmployee.full_name}`);
      console.log('Employee detail fetched successfully:', enrichedEmployee);
      
      return enrichedEmployee;
    },
    enabled: !!employeeId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error) => {
      // Don't retry if employee not found
      if (error.message.includes('Employee not found')) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};
