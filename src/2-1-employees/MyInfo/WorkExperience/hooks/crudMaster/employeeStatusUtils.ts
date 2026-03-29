
import { supabase } from '@/shared/lib/supabaseClient';
import { getCurrentOrganizationId } from '../useCurrentOrg';
import { EmployeeStatus } from './employeeStatusTypes';

export interface EmployeeStatusFormData {
  name: string;
  code?: string;
  description?: string;
}

export const createEmployeeStatus = async (data: EmployeeStatusFormData): Promise<EmployeeStatus> => {
  const { organizationId } = await getCurrentOrganizationId();
  
  const { data: status, error } = await supabase
    .from('employee_statuses')
    .insert({
      ...data,
      organization_id: organizationId,
    })
    .select()
    .single();

  if (error) throw error;
  return status;
};

export const updateEmployeeStatus = async (id: string, data: Partial<EmployeeStatusFormData>): Promise<EmployeeStatus> => {
  const { data: status, error } = await supabase
    .from('employee_statuses')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return status;
};

export const deleteEmployeeStatus = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('employee_statuses')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const fetchEmployeeStatuses = async (): Promise<EmployeeStatus[]> => {
  const { organizationId } = await getCurrentOrganizationId();
  
  const { data: statuses, error } = await supabase
    .from('employee_statuses')
    .select('*')
    .or(`organization_id.eq.${organizationId},organization_id.is.null`)
    .eq('is_active', true)
    .order('name');

  if (error) throw error;
  return statuses || [];
};

export const buildEmployeeStatusQueryKey = (id?: string) => {
  return id ? ['employee_statuses', id] : ['employee_statuses'];
};
