
import { supabase } from '@/shared/lib/supabaseClient';
import { getCurrentOrganizationId } from '../useCurrentOrg';
import { JobPosition } from './jobPositionTypes';

export interface JobPositionFormData {
  name: string;
  code?: string;
  description?: string;
  department_id?: string;
}

export const createJobPosition = async (data: JobPositionFormData): Promise<JobPosition> => {
  const { organizationId } = await getCurrentOrganizationId();
  
  const { data: jobPosition, error } = await supabase
    .from('job_positions')
    .insert({
      ...data,
      organization_id: organizationId,
    })
    .select()
    .single();

  if (error) throw error;
  return jobPosition;
};

export const updateJobPosition = async (id: string, data: Partial<JobPositionFormData>): Promise<JobPosition> => {
  const { data: jobPosition, error } = await supabase
    .from('job_positions')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return jobPosition;
};

export const deleteJobPosition = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('job_positions')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const fetchJobPositions = async (departmentId?: string): Promise<JobPosition[]> => {
  const { organizationId } = await getCurrentOrganizationId();
  
  let query = supabase
    .from('job_positions')
    .select('*')
    .or(`organization_id.eq.${organizationId},organization_id.is.null`)
    .eq('is_active', true);
    
  // If department is provided, filter by department
  if (departmentId) {
    query = query.eq('department_id', departmentId);
  }
  
  const { data: jobPositions, error } = await query.order('name');

  if (error) throw error;
  return jobPositions || [];
};

export const buildJobPositionQueryKey = (id?: string) => {
  return id ? ['job_positions', id] : ['job_positions'];
};
