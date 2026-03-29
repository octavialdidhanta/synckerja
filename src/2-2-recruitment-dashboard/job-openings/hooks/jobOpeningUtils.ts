
import { supabase } from '@/shared/lib/supabaseClient';
import { getCurrentOrganizationId } from '@/shared/auth/hooks/useCurrentOrg';
import { JobOpening, JobOpeningFormData, JobBenefit } from './jobOpeningTypes';

const UUID_FIELDS = ['department_id', 'job_position_id', 'job_level_id', 'employment_status_id'] as const;

function sanitizeUuidFields<T extends Record<string, any>>(obj: T): T {
  const out = { ...obj };
  for (const key of UUID_FIELDS) {
    if (key in out && (out[key] === '' || out[key] === undefined)) {
      (out as any)[key] = null;
    }
  }
  return out;
}

// Helper function to safely convert Json to JobBenefit[]
const parseJobBenefits = (benefits: any): JobBenefit[] => {
  if (!benefits) return [];
  if (Array.isArray(benefits)) return benefits;
  if (typeof benefits === 'string') {
    try {
      const parsed = JSON.parse(benefits);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const createJobOpening = async (data: JobOpeningFormData): Promise<JobOpening> => {
  const { organizationId } = await getCurrentOrganizationId();
  
  const base = sanitizeUuidFields({
    ...data,
    organization_id: organizationId,
    created_by: (await supabase.auth.getUser()).data.user?.id,
    benefits: data.benefits ? JSON.stringify(data.benefits) : JSON.stringify([])
  });
  const insertData = {
    ...base,
    benefits: base.benefits ?? JSON.stringify([])
  };

  const { data: jobOpening, error } = await supabase
    .from('job_openings')
    .insert(insertData)
    .select(`
      *,
      departments(name),
      job_positions(name),
      job_levels(name),
      employee_statuses(name)
    `)
    .single();

  if (error) throw error;
  
  return {
    ...jobOpening,
    status: jobOpening.status as 'active' | 'inactive' | 'draft' | 'closed',
    benefits: parseJobBenefits(jobOpening.benefits)
  };
};

export const updateJobOpening = async (id: string, data: Partial<JobOpeningFormData>): Promise<JobOpening> => {
  const raw = {
    ...data,
    benefits: data.benefits ? JSON.stringify(data.benefits) : undefined
  };
  const updateData = sanitizeUuidFields(raw);

  const { data: jobOpening, error } = await supabase
    .from('job_openings')
    .update(updateData)
    .eq('id', id)
    .select(`
      *,
      departments(name),
      job_positions(name),
      job_levels(name),
      employee_statuses(name)
    `)
    .single();

  if (error) throw error;
  
  return {
    ...jobOpening,
    status: jobOpening.status as 'active' | 'inactive' | 'draft' | 'closed',
    benefits: parseJobBenefits(jobOpening.benefits)
  };
};

export const deleteJobOpening = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('job_openings')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const fetchJobOpenings = async (): Promise<JobOpening[]> => {
  const { organizationId } = await getCurrentOrganizationId();
  
  const { data: jobOpenings, error } = await supabase
    .from('job_openings')
    .select(`
      *,
      departments(name),
      job_positions(name),
      job_levels(name),
      employee_statuses(name),
      creator_profile:profiles!job_openings_created_by_fkey(full_name, email)
    `)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  return (jobOpenings || []).map(job => ({
    ...job,
    status: job.status as 'active' | 'inactive' | 'draft' | 'closed',
    benefits: parseJobBenefits(job.benefits),
    creator_profile: job.creator_profile && 
                    typeof job.creator_profile === 'object' && 
                    !Array.isArray(job.creator_profile) &&
                    'full_name' in job.creator_profile 
      ? job.creator_profile as { full_name: string; email: string }
      : null
  }));
};

export const incrementJobClicks = async (jobId: string): Promise<void> => {
  const { error } = await supabase.rpc('increment_job_clicks', { job_id: jobId });
  if (error) throw error;
};

export const incrementJobSubmissions = async (jobId: string): Promise<void> => {
  const { error } = await supabase.rpc('increment_job_submissions', { job_id: jobId });
  if (error) throw error;
};

export const buildJobOpeningQueryKey = (id?: string) => {
  return id ? ['job_openings', id] : ['job_openings'];
};
