import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { toast } from 'sonner';
import type { EmployeePayrollInfo, PayrollComponent } from './useEmployeePayroll';

// Hook to fetch payroll info
export const useEmployeePayrollInfo = (employeeId: string) => {
  return useQuery({
    queryKey: ['employee-payroll-info', employeeId],
    queryFn: async () => {
      if (!employeeId) throw new Error('Employee ID is required');

      const { data: payrollData, error: payrollError } = await supabase
        .from('employee_payroll_info')
        .select('*')
        .eq('employee_id', employeeId)
        .maybeSingle();

      if (payrollError) {
        console.error('Payroll fetch error:', payrollError);
        throw payrollError;
      }

      return payrollData as EmployeePayrollInfo | null;
    },
    enabled: !!employeeId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Hook to fetch payroll components
export const usePayrollComponents = (payrollInfoId?: string) => {
  return useQuery({
    queryKey: ['payroll-components', payrollInfoId],
    queryFn: async () => {
      if (!payrollInfoId) return [];

      const { data: componentsData, error: componentsError } = await supabase
        .from('employee_payroll_components')
        .select('*')
        .eq('employee_payroll_info_id', payrollInfoId)
        .eq('is_active', true);

      if (componentsError) {
        console.error('Components fetch error:', componentsError);
        throw componentsError;
      }

      return (componentsData || []) as PayrollComponent[];
    },
    enabled: !!payrollInfoId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

// Hook to save payroll info
export const useSavePayrollInfo = (employeeId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<EmployeePayrollInfo>) => {
      const { data: employee } = await supabase
        .from('employees')
        .select('organization_id')
        .eq('id', employeeId)
        .single();

      if (!employee) throw new Error('Employee not found');

      // If ptkp_status is being updated, find matching tax configuration
      let payrollDataWithTaxConfig = { ...data };
      
      if (data.ptkp_status) {
        const { data: taxConfig, error: taxConfigError } = await supabase
          .from('tax_configurations')
          .select('id')
          .eq('ptkp_status', data.ptkp_status)
          .eq('is_active', true)
          .or(`organization_id.eq.${employee.organization_id},organization_id.is.null`)
          .order('organization_id', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        if (taxConfigError) {
          console.error('Error fetching tax configuration:', taxConfigError);
        } else if (taxConfig) {
          payrollDataWithTaxConfig.tax_configuration_id = taxConfig.id;
          console.log(`Setting tax_configuration_id to ${taxConfig.id} for PTKP status ${data.ptkp_status}`);
        } else {
          console.warn(`No tax configuration found for PTKP status: ${data.ptkp_status}`);
        }
      }

      // Check if payroll info exists for this employee
      const { data: existingPayrollInfo } = await supabase
        .from('employee_payroll_info')
        .select('id')
        .eq('employee_id', employeeId)
        .maybeSingle();

      if (existingPayrollInfo?.id) {
        // Update existing
        const { data: updatedData, error } = await supabase
          .from('employee_payroll_info')
          .update(payrollDataWithTaxConfig)
          .eq('id', existingPayrollInfo.id)
          .select()
          .single();

        if (error) throw error;
        return updatedData as EmployeePayrollInfo;
      } else {
        // Create new
        const { data: newData, error } = await supabase
          .from('employee_payroll_info')
          .insert({
            ...payrollDataWithTaxConfig,
            employee_id: employeeId,
            organization_id: employee.organization_id,
          })
          .select()
          .single();

        if (error) throw error;
        return newData as EmployeePayrollInfo;
      }
    },
    onSuccess: (data) => {
      // Invalidate and refetch payroll info
      queryClient.invalidateQueries({ queryKey: ['employee-payroll-info', employeeId] });
      // Don't show toast here - let component handle it
    },
    onError: (error: any) => {
      console.error('Failed to save payroll info:', error);
      toast.error('Failed to save payroll info');
    },
  });
};

// Hook to add payroll component
export const useAddPayrollComponent = (employeeId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      component, 
      payrollInfoId 
    }: { 
      component: Omit<PayrollComponent, 'id' | 'employee_payroll_info_id' | 'organization_id'>; 
      payrollInfoId: string;
    }) => {
      const { data: employee } = await supabase
        .from('employees')
        .select('organization_id')
        .eq('id', employeeId)
        .single();

      if (!employee) throw new Error('Employee not found');

      const { data, error } = await supabase
        .from('employee_payroll_components')
        .insert({
          ...component,
          employee_payroll_info_id: payrollInfoId,
          organization_id: employee.organization_id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as PayrollComponent;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-components', data.employee_payroll_info_id] });
      toast.success('Payroll component added successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add payroll component');
    },
  });
};

// Hook to update payroll component
export const useUpdatePayrollComponent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<PayrollComponent> }) => {
      const { data, error } = await supabase
        .from('employee_payroll_components')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as PayrollComponent;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-components', data.employee_payroll_info_id] });
      toast.success('Payroll component updated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to update payroll component');
    },
  });
};

// Hook to delete payroll component
export const useDeletePayrollComponent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payrollInfoId }: { id: string; payrollInfoId: string }) => {
      const { error } = await supabase
        .from('employee_payroll_components')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id, payrollInfoId };
    },
    onSuccess: ({ payrollInfoId }) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-components', payrollInfoId] });
      toast.success('Payroll component deleted successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to delete payroll component');
    },
  });
};


















