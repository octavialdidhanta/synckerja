import { useState, useEffect } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { toast } from 'sonner';

export interface EmployeePayrollInfo {
  id?: string;
  employee_id: string;
  organization_id: string;
  basic_salary: number;
  salary_type: 'monthly' | 'weekly' | 'daily';
  salary_configuration: 'taxable' | 'non_taxable';
  taxable_date?: string;
  prorate_based_on: 'working_day' | 'calendar_day';
  count_national_holiday_as_working_day: boolean;
  ptkp_status: string;
  employee_tax_status: 'pegawai_tetap' | 'pegawai_tidak_tetap' | 'ekspatriat' | 'freelancer';
  overtime_eligible: boolean;
  tax_method: 'gross' | 'gross_up' | 'netto';
  jht_configuration: string;
  bpjs_kesehatan_configuration: 'by_company' | 'by_employee' | 'shared';
  bpjs_ketenagakerjaan_number?: string;
  bpjs_kesehatan_number?: string;
  bpjs_kesehatan_family_members: number;
  bpjs_ketenagakerjaan_date?: string;
  bpjs_kesehatan_date?: string;
  npwp?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_holder?: string;
  currency: string;
  beginning_netto: number;
  pph21_paid: number;
  tax_configuration_id?: string;
}

export interface PayrollComponent {
  id?: string;
  employee_payroll_info_id: string;
  organization_id: string;
  component_name: string;
  component_type: 'allowance' | 'deduction';
  component_category: string;
  amount: number;
  is_percentage: boolean;
  percentage_base: 'basic_salary' | 'gross_salary';
  is_taxable: boolean;
  is_active: boolean;
  is_recurring: boolean;
  payroll_period_id?: string;
}

export const useEmployeePayroll = (employeeId: string) => {
  const [payrollInfo, setPayrollInfo] = useState<EmployeePayrollInfo | null>(null);
  const [payrollComponents, setPayrollComponents] = useState<PayrollComponent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPayrollInfo = async () => {
    if (!employeeId) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const { data: payrollData, error: payrollError } = await supabase
        .from('employee_payroll_info')
        .select('*')
        .eq('employee_id', employeeId)
        .maybeSingle();

      if (payrollError) {
        console.error('Payroll fetch error:', payrollError);
        throw payrollError;
      }

      if (payrollData) {
        setPayrollInfo(payrollData as EmployeePayrollInfo);
        
        // Fetch payroll components
        const { data: componentsData, error: componentsError } = await supabase
          .from('employee_payroll_components')
          .select('*')
          .eq('employee_payroll_info_id', payrollData.id)
          .eq('is_active', true);

        if (componentsError) {
          console.error('Components fetch error:', componentsError);
          throw componentsError;
        }
        setPayrollComponents((componentsData || []) as PayrollComponent[]);
      } else {
        // No payroll info found, set empty state to allow creation
        setPayrollInfo(null);
        setPayrollComponents([]);
      }
    } catch (err) {
      console.error('Error in fetchPayrollInfo:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch payroll info'));
    } finally {
      setIsLoading(false);
    }
  };

  const savePayrollInfo = async (data: Partial<EmployeePayrollInfo>) => {
    setIsLoading(true);
    setError(null);

    try {
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
        setPayrollInfo(updatedData as EmployeePayrollInfo);
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
        setPayrollInfo(newData as EmployeePayrollInfo);
      }

      // Don't show toast here, let the component handle it
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to save payroll info');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const addPayrollComponent = async (component: Omit<PayrollComponent, 'id' | 'employee_payroll_info_id' | 'organization_id'>) => {
    try {
      let currentPayrollInfo = payrollInfo;
      
      // If payroll info doesn't exist, create it first with default values
      if (!currentPayrollInfo?.id) {
        const { data: employee } = await supabase
          .from('employees')
          .select('organization_id')
          .eq('id', employeeId)
          .single();

        if (!employee) throw new Error('Employee not found');

        // Find tax configuration for default PTKP status
        const defaultPtkpStatus = 'TK/0';
        const { data: taxConfig } = await supabase
          .from('tax_configurations')
          .select('id')
          .eq('ptkp_status', defaultPtkpStatus)
          .eq('is_active', true)
          .or(`organization_id.eq.${employee.organization_id},organization_id.is.null`)
          .order('organization_id', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        const defaultPayrollInfo = {
          employee_id: employeeId,
          organization_id: employee.organization_id,
          basic_salary: 0,
          salary_type: 'monthly' as const,
          salary_configuration: 'taxable' as const,
          prorate_based_on: 'working_day' as const,
          count_national_holiday_as_working_day: false,
          ptkp_status: defaultPtkpStatus,
          employee_tax_status: 'pegawai_tetap' as const,
          overtime_eligible: false,
          tax_method: 'gross' as const,
          jht_configuration: 'default',
          bpjs_kesehatan_configuration: 'by_company' as const,
          bpjs_kesehatan_family_members: 0,
          currency: 'IDR',
          beginning_netto: 0,
          pph21_paid: 0,
          tax_configuration_id: taxConfig?.id,
        };

        const { data: newPayrollInfo, error: payrollError } = await supabase
          .from('employee_payroll_info')
          .insert(defaultPayrollInfo)
          .select()
          .single();

        if (payrollError) throw payrollError;
        
        currentPayrollInfo = newPayrollInfo as EmployeePayrollInfo;
        setPayrollInfo(currentPayrollInfo);
      }

      // Now add the component
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
          employee_payroll_info_id: currentPayrollInfo.id,
          organization_id: employee.organization_id,
        })
        .select()
        .single();

      if (error) throw error;
      setPayrollComponents(prev => [...prev, data as PayrollComponent]);
      toast.success('Payroll component added successfully');
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to add payroll component');
      toast.error(error.message);
      throw error;
    }
  };

  const updatePayrollComponent = async (id: string, updates: Partial<PayrollComponent>) => {
    const { data, error } = await supabase
      .from('employee_payroll_components')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    setPayrollComponents(prev => prev.map(c => c.id === id ? data as PayrollComponent : c));
    toast.success('Payroll component updated successfully');
  };

  const deletePayrollComponent = async (id: string) => {
    const { error } = await supabase
      .from('employee_payroll_components')
      .delete()
      .eq('id', id);

    if (error) throw error;
    setPayrollComponents(prev => prev.filter(c => c.id !== id));
    toast.success('Payroll component deleted successfully');
  };

  useEffect(() => {
    if (employeeId) {
      fetchPayrollInfo();
    }
  }, [employeeId]);

  return {
    payrollInfo,
    payrollComponents,
    isLoading,
    error,
    savePayrollInfo,
    addPayrollComponent,
    updatePayrollComponent,
    deletePayrollComponent,
    refetch: fetchPayrollInfo,
  };
};
