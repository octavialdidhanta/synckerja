import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

export interface JobApplication {
  id: string;
  applicant_name: string;
  applicant_email: string;
  applicant_phone?: string;
  experience_years?: string;
  expected_salary?: string;
  skills?: any;
  status?: string;
  created_at: string;
  recruitment_token?: string;
  interview_status?: string;
  interview_date?: string;
  interview_time?: string;
  interview_location?: string;
  interviewer_name?: string;
  interviewer_email?: string;
  interview_notes?: string;
  job_opening_id: string;
  recruitment_link_id?: string;
  candidate_profile_id?: string;
  job_openings?: {
    job_title: string;
    organization_id: string;
  };
}

interface UseJobApplicationsProps {
  status?: string;
  jobId?: string;
}

export const useJobApplications = ({ status, jobId }: UseJobApplicationsProps = {}) => {
  const { organizationId } = useCurrentOrg();
  
  return useQuery({
    queryKey: ['job-applications', organizationId, status, jobId],
    queryFn: async () => {
      if (!organizationId) {
        console.log('⚠️ No organization ID found, returning empty array');
        return [];
      }

      console.log('🔍 Fetching job applications with filters:', { organizationId, status, jobId });
      
      let query = supabase
        .from('job_applications')
        .select(`
          *,
          job_openings!inner (
            job_title,
            organization_id
          )
        `)
        .eq('job_openings.organization_id', organizationId)
        .order('created_at', { ascending: false });

      // Filter by status if provided
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      // Filter by job ID if provided
      if (jobId) {
        query = query.eq('job_opening_id', jobId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Error fetching job applications:', error);
        throw error;
      }

      console.log('✅ Job applications fetched successfully:', data?.length || 0);
      return data as JobApplication[];
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};