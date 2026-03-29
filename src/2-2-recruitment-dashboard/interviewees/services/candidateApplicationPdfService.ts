import { supabase } from '@/shared/lib/supabaseClient';

export interface CandidateProfilePayload {
  id: string;
  full_name: string;
  email: string;
  mobile_phone?: string;
  birth_date?: string;
  birth_place?: string;
  gender?: string;
  nik?: string;
  religion?: string;
  marital_status?: string;
  nationality?: string;
  blood_type?: string;
  address?: string;
  citizen_address?: string;
  postal_code?: string;
  photo_url?: string;
  recruitment_token?: string;
  submitted_at?: string;
}

export interface JobOpeningPayload {
  job_title: string;
}

export interface JobApplicationPayload {
  id: string;
  recruitment_token: string;
  job_openings?: JobOpeningPayload | null;
}

export interface CandidateEducationPayload {
  id: string;
  institution_name?: string;
  degree?: string;
  field_of_study?: string;
  start_date?: string;
  end_date?: string;
  grade_gpa?: string;
  description?: string;
  is_current?: boolean;
}

export interface CandidateInformalEducationPayload {
  id: string;
  course_name: string;
  provider?: string;
  field_of_certification?: string;
  certificate_number?: string;
  start_date?: string;
  end_date?: string;
  description?: string;
}

export interface CandidateWorkExperiencePayload {
  id: string;
  company_name: string;
  position: string;
  job_description?: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
  location?: string;
}

export interface CandidateFamilyMemberPayload {
  id: string;
  name: string;
  relationship: string;
  gender?: string;
  age?: number;
  occupation?: string;
  phone?: string;
  address?: string;
  is_emergency_contact: boolean;
}

export interface CandidateDocumentPayload {
  id: string;
  file_path: string;
  file_name: string;
  document_type: string;
  mime_type?: string;
}

export interface QuestionReviewPayload {
  id: string;
  question_text?: string;
}

export interface ReviewCategoryPayload {
  id: string;
  name?: string;
}

export interface CandidateReviewPayload {
  id: string;
  rating: number;
  review_text?: string;
  reviewer_name?: string;
  created_at?: string;
  question_review?: QuestionReviewPayload | null;
  review_category?: ReviewCategoryPayload | null;
}

export interface CandidateApplicationPdfPayload {
  profile: CandidateProfilePayload | null;
  jobApplication: JobApplicationPayload | null;
  educations: CandidateEducationPayload[];
  informalEducations: CandidateInformalEducationPayload[];
  workExperiences: CandidateWorkExperiencePayload[];
  familyMembers: CandidateFamilyMemberPayload[];
  documents: CandidateDocumentPayload[];
  reviews: CandidateReviewPayload[];
}

const DOCUMENT_TYPE_ORDER = ['cv', 'ktp', 'ijazah', 'transcript', 'portfolio', 'other'];

function sortDocuments(docs: CandidateDocumentPayload[]): CandidateDocumentPayload[] {
  return [...docs].sort((a, b) => {
    const ai = DOCUMENT_TYPE_ORDER.indexOf(a.document_type);
    const bi = DOCUMENT_TYPE_ORDER.indexOf(b.document_type);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

/**
 * Fetches all data needed to generate the candidate application PDF.
 * Uses candidate_profile_id and recruitment_token from the interviewees row.
 */
export async function fetchCandidateApplicationData(
  candidateProfileId: string,
  recruitmentToken: string
): Promise<CandidateApplicationPdfPayload> {
  const [
    profileResult,
    jobAppResult,
    educationsResult,
    informalResult,
    workResult,
    familyResult,
    documentsResult,
    reviewsResult
  ] = await Promise.all([
    supabase.from('candidate_profiles').select('*').eq('id', candidateProfileId).maybeSingle(),
    supabase
      .from('job_applications')
      .select('id, recruitment_token, job_openings(job_title)')
      .eq('recruitment_token', recruitmentToken)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('candidate_educations')
      .select('*')
      .eq('candidate_profile_id', candidateProfileId)
      .order('start_date', { ascending: false }),
    supabase
      .from('candidate_informal_educations')
      .select('*')
      .eq('candidate_profile_id', candidateProfileId)
      .order('created_at', { ascending: false }),
    supabase
      .from('candidate_work_experiences')
      .select('*')
      .eq('candidate_profile_id', candidateProfileId)
      .order('created_at', { ascending: false }),
    supabase
      .from('candidate_family_members')
      .select('*')
      .eq('candidate_profile_id', candidateProfileId)
      .order('created_at', { ascending: false }),
    supabase
      .from('candidate_documents')
      .select('id, file_path, file_name, document_type, mime_type')
      .eq('candidate_profile_id', candidateProfileId)
      .order('created_at', { ascending: false }),
    supabase
      .from('candidate_reviews')
      .select(`
        id,
        rating,
        review_text,
        reviewer_name,
        created_at,
        review_category:review_category_id (id, name),
        question_review:question_review_id (id, question_text)
      `)
      .eq('candidate_profile_id', candidateProfileId)
      .order('created_at', { ascending: false })
  ]);

  if (profileResult.error) throw profileResult.error;
  if (jobAppResult.error) throw jobAppResult.error;
  if (educationsResult.error) throw educationsResult.error;
  if (informalResult.error) throw informalResult.error;
  if (workResult.error) throw workResult.error;
  if (familyResult.error) throw familyResult.error;
  if (documentsResult.error) throw documentsResult.error;
  if (reviewsResult.error) throw reviewsResult.error;

  const documents = sortDocuments((documentsResult.data || []) as CandidateDocumentPayload[]);
  const jobAppData = Array.isArray(jobAppResult.data) ? jobAppResult.data[0] : jobAppResult.data;

  return {
    profile: (profileResult.data as CandidateProfilePayload) || null,
    jobApplication: (jobAppData as JobApplicationPayload) || null,
    educations: (educationsResult.data || []) as CandidateEducationPayload[],
    informalEducations: (informalResult.data || []) as CandidateInformalEducationPayload[],
    workExperiences: (workResult.data || []) as CandidateWorkExperiencePayload[],
    familyMembers: (familyResult.data || []) as CandidateFamilyMemberPayload[],
    documents,
    reviews: (reviewsResult.data || []) as CandidateReviewPayload[]
  };
}
