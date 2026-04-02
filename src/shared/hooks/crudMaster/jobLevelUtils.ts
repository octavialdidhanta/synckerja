
import { supabase } from '@/shared/lib/supabaseClient';
import { getCurrentOrganizationId } from '@/shared/auth/hooks/useCurrentOrg';
import { JobLevel } from './jobLevelTypes';

export interface JobLevelFormData {
  name: string;
  code?: string;
  description?: string;
  level_order?: number;
}

export const createJobLevel = async (data: JobLevelFormData): Promise<JobLevel> => {
  const { organizationId } = await getCurrentOrganizationId();
  
  const { data: jobLevel, error } = await supabase
    .from('job_levels')
    .insert({
      ...data,
      organization_id: organizationId,
    })
    .select()
    .single();

  if (error) throw error;
  return jobLevel;
};

export const updateJobLevel = async (id: string, data: Partial<JobLevelFormData>): Promise<JobLevel> => {
  const { data: jobLevel, error } = await supabase
    .from('job_levels')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return jobLevel;
};

export const deleteJobLevel = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('job_levels')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const fetchJobLevels = async (): Promise<JobLevel[]> => {
  const { organizationId } = await getCurrentOrganizationId();
  
  const { data: jobLevels, error } = await supabase
    .from('job_levels')
    .select('*')
    .or(`organization_id.eq.${organizationId},organization_id.is.null`)
    .eq('is_active', true)
    .order('level_order', { ascending: true });

  if (error) throw error;
  return jobLevels || [];
};

export const buildJobLevelQueryKey = (id?: string) => {
  return id ? ['job_levels', id] : ['job_levels'];
};
