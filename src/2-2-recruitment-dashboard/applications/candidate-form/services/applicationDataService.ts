
import { supabase } from '@/shared/lib/supabaseClient';

/** RPC not yet in generated DB types. */
type UntypedRpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;

interface FormData {
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  coverLetter: string;
  experienceYears: string;
  expectedSalary: string;
  birth_date: string;
  gender: string;
  nik: string;
}

export interface SubmitApplicationResult {
  applicationId: string;
  candidateProfileId: string;
  /** Per-applicant token (cand_...). Used for /candidate/profile?token= and the candidate tests. */
  candidateToken: string;
  profileLink: string;
}

/**
 * Public application submit. Runs server-side (RPC `submit_job_application`): validates the
 * recruitment link, creates the job application + candidate profile, issues a per-applicant token
 * and updates the click/submission counters. Anon cannot insert these rows directly.
 */
export const submitApplicationData = async (
  formData: FormData,
  cvFilePath: string,
  skills: Array<{ title: string; skill_level: string; is_required?: boolean }>,
  _jobId: string,
  _recruitmentLinkId?: string,
  recruitmentToken?: string,
  _organizationId?: string
): Promise<SubmitApplicationResult> => {
  if (!recruitmentToken) {
    throw new Error('Missing recruitment token. Please access this job through a valid recruitment link.');
  }

  const { data, error } = await (supabase.rpc as unknown as UntypedRpc)('submit_job_application', {
    p_link_token: recruitmentToken,
    p_applicant: {
      applicant_name: formData.applicantName,
      applicant_email: formData.applicantEmail,
      applicant_phone: formData.applicantPhone || null,
      birth_date: formData.birth_date || null,
      gender: formData.gender || null,
      nik: formData.nik || null,
      cover_letter: formData.coverLetter || null,
      experience_years: formData.experienceYears || null,
      expected_salary: formData.expectedSalary || null,
    },
    p_skills: skills,
    p_cv_path: cvFilePath || null,
  });

  if (error) {
    console.error('❌ Error submitting application:', error);
    throw new Error(error.message || 'Failed to submit job application');
  }

  const result = (data ?? {}) as { application_id?: string; candidate_profile_id?: string; token?: string };
  if (!result.token || !result.candidate_profile_id || !result.application_id) {
    throw new Error('Failed to submit job application');
  }

  return {
    applicationId: result.application_id,
    candidateProfileId: result.candidate_profile_id,
    candidateToken: result.token,
    profileLink: `/candidate/profile?token=${encodeURIComponent(result.token)}`,
  };
};

export const getJobOrganization = async (jobId: string) => {
  try {
    const { data, error } = await supabase
      .from('job_openings')
      .select('organization_id')
      .eq('id', jobId)
      .single();

    if (error) {
      console.error('❌ Error fetching job organization:', error);
      throw new Error(`Failed to get job organization: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('❌ Error in getJobOrganization:', error);
    throw error;
  }
};
