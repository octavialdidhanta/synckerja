import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { ApplicationForm } from '@/2-2-recruitment-dashboard/applications/public/ApplicationForm';
import { CandidateInfoTabs } from '@/2-2-recruitment-dashboard/applications/candidate-form';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/components/ui/use-toast';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { ArrowLeft, Send } from 'lucide-react';

interface JobData {
  id: string;
  job_title: string;
  job_description?: string;
  requirements?: string;
  responsibilities?: string;
  benefits?: any;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  organizations?: {
    company_name: string;
    industry?: string;
    description?: string;
    website?: string;
    address?: string;
  };
  departments?: { name: string };
  job_positions?: { name: string };
  job_levels?: { name: string };
  employee_statuses?: { name: string };
}

interface RecruitmentLinkData {
  id: string;
  job_opening_id: string;
  token: string;
  job_openings?: JobData;
}

export default function JobApplication() {
  const [searchParams] = useSearchParams();
  const { token: tokenFromParams } = useParams<{ token?: string }>();
  // Support both URL parameter (/apply/preview/:token) and query parameter (/candidate/apply?token=...)
  const token = tokenFromParams || searchParams.get('token');
  const [jobData, setJobData] = useState<JobData | null>(null);
  const [recruitmentLinkData, setRecruitmentLinkData] = useState<RecruitmentLinkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requiredSkills, setRequiredSkills] = useState<Array<{ title: string; skill_level: string; is_required: boolean }>>([]);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const { toast } = useToast();

  // Master data states
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [jobPositions, setJobPositions] = useState<Array<{ id: string; name: string }>>([]);
  const [jobLevels, setJobLevels] = useState<Array<{ id: string; name: string }>>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [employeeStatuses, setEmployeeStatuses] = useState<Array<{ id: string; name: string }>>([]);

  // Form data state
  const [formData, setFormData] = useState({
    // Personal Information
    applicantName: '',
    applicantEmail: '',
    applicantPhone: '',
    birth_date: '',
    gender: '',
    nik: '',
    religion: '',
    marital_status: '',
    nationality: '',
    blood_type: '',
    
    // Address Information
    birth_place: '',
    address: '',
    citizen_address: '',
    postal_code: '',
    
    // Employment Information (read-only)
    department_id: '',
    job_position_id: '',
    job_level_id: '',
    branch_id: '',
    employee_status_id: '',
    join_date: '',
    hire_date: '',
    employment_status: 'pending',
    
    // Application specific
    coverLetter: '',
    experienceYears: '',
    expectedSalary: ''
  });

  const loadMasterData = useCallback(async () => {
    try {
      const [deptRes, posRes, levelRes, branchRes, statusRes] = await Promise.all([
        supabase.from('departments').select('id, name').eq('is_active', true),
        supabase.from('job_positions').select('id, name').eq('is_active', true),
        supabase.from('job_levels').select('id, name').eq('is_active', true),
        supabase.from('branches').select('id, name').eq('is_active', true),
        supabase.from('employee_statuses').select('id, name').eq('is_active', true)
      ]);

      if (deptRes.data && !deptRes.error) setDepartments(deptRes.data as unknown as Array<{ id: string; name: string }>);
      if (posRes.data && !posRes.error) setJobPositions(posRes.data as unknown as Array<{ id: string; name: string }>);
      if (levelRes.data && !levelRes.error) setJobLevels(levelRes.data as unknown as Array<{ id: string; name: string }>);
      if (branchRes.data && !branchRes.error) setBranches(branchRes.data as unknown as Array<{ id: string; name: string }>);
      if (statusRes.data && !statusRes.error) setEmployeeStatuses(statusRes.data as unknown as Array<{ id: string; name: string }>);
    } catch (error) {
      console.error('Error loading master data:', error);
    }
  }, []);

  const fetchJobByToken = useCallback(async () => {
    if (!token) return;
    
    try {
      console.log('🔍 Fetching job data for token:', token);
      
      const { data, error } = await (supabase.rpc as any)('get_job_by_recruitment_token', {
        token_param: token
      });

      if (error) {
        console.error('❌ Error fetching job data:', error);
        throw error;
      }

      if (!data) {
        console.warn('⚠️ No job data found for token:', token);
        setError('Job posting not found or has expired');
        return;
      }

      console.log('✅ Job data retrieved:', data);
      
      const recruitmentData = data as unknown as RecruitmentLinkData;
      setRecruitmentLinkData(recruitmentData);
      
      if (recruitmentData.job_openings) {
        setJobData(recruitmentData.job_openings);
      }

      // Fetch required skills for this job
      const { data: skillsData, error: skillsError } = await supabase
        .from('recruitment_skills')
        .select('title, skill_level, is_required')
        .eq('job_opening_id', recruitmentData.job_opening_id);

      if (skillsError) {
        console.warn('⚠️ Could not fetch skills:', skillsError);
      } else if (skillsData && !skillsError) {
        setRequiredSkills(skillsData as unknown as Array<{ title: string; skill_level: string; is_required: boolean }>);
        console.log('🎯 Required skills:', skillsData);
      }

    } catch (error) {
      console.error('💥 Error in fetchJobByToken:', error);
      setError('Failed to load job posting');
      toast({
        title: "Error",
        description: "Failed to load job posting. Please check the link and try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [token, toast]);

  useEffect(() => {
    // Public route: allow document scrolling (app shell defaults to overflow-hidden).
    document.body.classList.add("allow-page-scroll");
    document.getElementById("root")?.classList.add("allow-page-scroll");
    return () => {
      document.body.classList.remove("allow-page-scroll");
      document.getElementById("root")?.classList.remove("allow-page-scroll");
    };
  }, []);

  useEffect(() => {
    if (token) {
      fetchJobByToken();
      loadMasterData();
    }
  }, [token, fetchJobByToken, loadMasterData]);

  const handleFormDataChange = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleApplicationClose = useCallback(() => {
    window.close();
  }, []);

  const handleProceedToApplication = useCallback(() => {
    setShowApplicationForm(true);
  }, []);

  // Memoize rendered content to prevent unnecessary re-renders
  const jobDetailsContent = useMemo(() => {
    if (!jobData) return null;

    return (
      <div className="space-y-6">
        {jobData.job_description && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Job Description</h3>
            <div className="text-sm text-gray-600 whitespace-pre-wrap">
              {jobData.job_description}
            </div>
          </div>
        )}

        {jobData.requirements && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Requirements</h3>
            <div className="text-sm text-gray-600 whitespace-pre-wrap">
              {jobData.requirements}
            </div>
          </div>
        )}

        {jobData.responsibilities && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Responsibilities</h3>
            <div className="text-sm text-gray-600 whitespace-pre-wrap">
              {jobData.responsibilities}
            </div>
          </div>
        )}

        {jobData.benefits && Array.isArray(jobData.benefits) && jobData.benefits.length > 0 && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Benefits</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
              {jobData.benefits.map((benefit: string, index: number) => (
                <li key={index}>{benefit}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Company Info */}
        {jobData.organizations && (
          <div className="pt-4 border-t">
            <h3 className="font-semibold text-gray-900 mb-2">About {jobData.organizations.company_name}</h3>
            <div className="space-y-2 text-sm text-gray-600">
              {jobData.organizations.industry && (
                <div>
                  <span className="font-medium">Industry:</span> {jobData.organizations.industry}
                </div>
              )}
              {jobData.organizations.website && (
                <div>
                  <span className="font-medium">Website:</span>{' '}
                  <a href={jobData.organizations.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {jobData.organizations.website}
                  </a>
                </div>
              )}
              {jobData.organizations.address && (
                <div>
                  <span className="font-medium">Address:</span> {jobData.organizations.address}
                </div>
              )}
              {jobData.organizations.description && (
                <div>
                  <span className="font-medium">About:</span> {jobData.organizations.description}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }, [jobData]);

  if (loading) {
    return (
      <div className="w-full h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !jobData) {
    return (
      <div className="w-full h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Job Not Found</h1>
          <p className="text-gray-600 mb-6">{error || 'The job posting you are looking for does not exist or has expired.'}</p>
          <Button onClick={handleApplicationClose} className="bg-blue-600 text-white hover:bg-blue-700">
            Close Window
          </Button>
        </div>
      </div>
    );
  }

  if (showApplicationForm) {
    return (
      <div className="min-h-screen w-full bg-gray-50">
        <div className="mx-auto w-full max-w-4xl px-4 py-6">
          <ApplicationForm
            jobId={jobData.id}
            jobTitle={jobData.job_title}
            companyName={jobData.organizations?.company_name || 'Company'}
            onClose={handleApplicationClose}
            recruitmentLinkId={recruitmentLinkData?.id}
            recruitmentToken={recruitmentLinkData?.token || token}
            requiredSkills={requiredSkills}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gray-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-4 lg:px-6 lg:py-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[20rem_1fr] lg:items-start">
          {/* Job Information */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="p-4 lg:p-6">
          {/* Job Header */}
          <div className="border-b pb-4 mb-6">
            <h1 className="text-xl font-bold text-gray-900 mb-2 leading-tight">
              {jobData.job_title}
            </h1>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="font-medium">{jobData.organizations?.company_name}</div>
              {jobData.location && (
                <div className="flex items-center">
                  <span>{jobData.location}</span>
                </div>
              )}
              {jobData.departments?.name && (
                <div>{jobData.departments.name}</div>
              )}
              {(jobData.salary_min || jobData.salary_max) && (
                <div className="text-green-600 font-semibold">
                  {jobData.salary_min && jobData.salary_max
                    ? `Rp ${jobData.salary_min.toLocaleString()} - Rp ${jobData.salary_max.toLocaleString()}`
                    : jobData.salary_min
                    ? `From Rp ${jobData.salary_min.toLocaleString()}`
                    : `Up to Rp ${jobData.salary_max?.toLocaleString()}`
                  }
                </div>
              )}
            </div>
          </div>

          {/* Job Details */}
          {jobDetailsContent}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex flex-col">
            {/* Header */}
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-4 lg:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3 sm:items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleApplicationClose}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Close
                  </Button>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Apply for Position</h2>
                    <p className="mt-1 text-sm text-gray-600">Complete your profile information to apply</p>
                  </div>
                </div>
                <Button onClick={handleProceedToApplication} className="bg-blue-600 text-white hover:bg-blue-700">
                  <Send className="mr-2 h-4 w-4" />
                  Continue to Application
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="mt-4">
              <Card className="shadow-sm">
                <CardContent className="p-4 sm:p-6">
                  <CandidateInfoTabs
                    formData={formData}
                    onChange={handleFormDataChange}
                    departments={departments}
                    jobPositions={jobPositions}
                    jobLevels={jobLevels}
                    branches={branches}
                    employeeStatuses={employeeStatuses}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
