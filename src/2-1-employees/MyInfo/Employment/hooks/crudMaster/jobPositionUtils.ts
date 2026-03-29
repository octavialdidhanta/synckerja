
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
  
  console.log('🔍 fetchJobPositions called:', { organizationId, departmentId });
  
  // Build query step by step
  let query = supabase
    .from('job_positions')
    .select('*');
  
  // Filter by organization: include organization's positions OR global positions (null)
  query = query.or(`organization_id.eq.${organizationId},organization_id.is.null`);
    
  // Filter by is_active: include both active (true) and null (for backward compatibility)
  // Note: We need to chain filters properly - use separate filter calls
  query = query.or('is_active.is.null,is_active.eq.true');
    
  // If department is provided, filter by department
  if (departmentId) {
    query = query.eq('department_id', departmentId);
    console.log('🔍 Added department filter:', departmentId);
  } else {
    console.log('🔍 No department filter - fetching all positions');
  }
  
  const { data: jobPositions, error } = await query.order('name');

  if (error) {
    console.error('❌ Error fetching job positions:', error);
    throw error;
  }
  
  console.log('✅ Job positions fetched:', { 
    count: jobPositions?.length || 0, 
    departmentId,
    organizationId,
    jobPositions: jobPositions?.slice(0, 5).map(p => ({ 
      id: p.id, 
      name: p.name, 
      department_id: p.department_id, 
      organization_id: p.organization_id,
      is_active: p.is_active 
    }))
  });
  
  return jobPositions || [];
};

export const buildJobPositionQueryKey = (id?: string) => {
  return id ? ['job_positions', id] : ['job_positions'];
};
