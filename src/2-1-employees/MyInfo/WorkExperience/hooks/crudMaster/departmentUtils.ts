
import { supabase } from '@/shared/lib/supabaseClient';
import { getCurrentOrganizationId } from '../useCurrentOrg';
import { Department } from './departmentTypes';

export interface DepartmentFormData {
  name: string;
  code?: string;
  description?: string;
}

export const createDepartment = async (data: DepartmentFormData): Promise<Department> => {
  const { organizationId } = await getCurrentOrganizationId();
  
  const { data: department, error } = await supabase
    .from('departments')
    .insert({
      ...data,
      organization_id: organizationId,
    })
    .select()
    .single();

  if (error) throw error;
  return department;
};

export const updateDepartment = async (id: string, data: Partial<DepartmentFormData>): Promise<Department> => {
  const { data: department, error } = await supabase
    .from('departments')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return department;
};

export const deleteDepartment = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('departments')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const fetchDepartments = async (): Promise<Department[]> => {
  try {
    const { organizationId } = await getCurrentOrganizationId();
    
    if (!organizationId) {
      console.warn('No organization ID found for departments');
      return [];
    }
    
    console.log('Fetching departments for organization:', organizationId);
    
    const { data: departments, error } = await supabase
      .from('departments')
      .select('*')
      .or(`organization_id.eq.${organizationId},organization_id.is.null`)
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching departments:', error);
      throw error;
    }
    
    console.log('Departments fetched successfully:', departments?.length || 0, 'departments');
    return departments || [];
  } catch (error) {
    console.error('Failed to fetch departments:', error);
    throw error;
  }
};

export const buildDepartmentQueryKey = (id?: string) => {
  return id ? ['departments', id] : ['departments'];
};
