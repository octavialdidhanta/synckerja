import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Building2, MapPin, DollarSign, Clock, Share2, MessageCircle, Users, Globe, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { ApplicationForm } from '@/2-2-recruitment-dashboard/applications/public/ApplicationForm';
// import { JobPreviewHeader } from '@/components/JobPreviewHeader'; // TODO: Implement JobPreviewHeader component
// import { JobPreviewFooter } from '@/components/JobPreviewFooter'; // TODO: Implement JobPreviewFooter component
import { getJobByToken, checkRecruitmentHealth } from '@/2-2-recruitment-dashboard/job-openings/hooks/optimizedRecruitmentLinkUtils';
import { RecruitmentLink } from '@/2-2-recruitment-dashboard/job-openings/hooks/recruitmentLinkTypes';
import { JobBenefit } from '@/2-2-recruitment-dashboard/job-openings/hooks/jobOpeningTypes';
import { useIsMobile } from '@/mobile/shared/hooks/use-mobile';
import { useCompanyLogo } from '@/shared/hooks/useCompanyLogo';
import { supabase } from '@/shared/lib/supabaseClient';

// Define the company type with all required fields
interface CompanyData {
  company_name: string;
  industry: string;
  address: string;
  website?: string;
  email?: string;
  description?: string;
  about_us?: string;
}

const JobPreview = () => {
  const { token } = useParams<{ token: string }>();
  const { logoUrl } = useCompanyLogo();
  const [jobData, setJobData] = useState<RecruitmentLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [requiredSkills, setRequiredSkills] = useState<any[]>([]);
  const isMobile = useIsMobile();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const CompanyLogo = ({ companyName, size = 'md' }: { companyName: string; size?: 'sm' | 'md' }) => {
    const sizeClass = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5 sm:w-6 sm:h-6';
    const containerSize = size === 'sm' ? 'w-4 h-4' : 'w-10 h-10 sm:w-12 sm:h-12';
    
    if (logoUrl) {
      return (
        <img 
          src={logoUrl} 
          alt={`${companyName} logo`}
          className={`${containerSize} object-cover rounded-lg flex-shrink-0`}
        />
      );
    }
    
    return (
      <div className={`${containerSize} bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0`}>
        <span className="text-white font-bold text-xs">
          {getInitials(companyName)}
        </span>
      </div>
    );
  };

  useEffect(() => {
    if (token) {
      loadJobData();
    } else {
      setError('Invalid job link - no token provided');
      setLoading(false);
    }
  }, [token, retryAttempt]);

  const loadJobData = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🚀 Loading job data for token:', token);
      
      const data = await getJobByToken(token!);
      
      if (!data) {
        console.warn('⚠️ No job data returned');
        setError('Job not found. This link may have expired or the job posting has been removed.');
        await checkHealthAndSetStatus();
        return;
      }
      
      console.log('✅ Job data loaded successfully');
      setJobData(data);

      // Load required skills if job opening exists
      if (data.job_openings?.id) {
        try {
          const { data: skillsData, error: skillsError } = await supabase
            .from('recruitment_skills')
            .select('title, skill_level, is_required, description')
            .eq('job_opening_id', data.job_openings.id)
            .order('is_required', { ascending: false });

          if (!skillsError && skillsData) {
            setRequiredSkills(skillsData);
          }
        } catch (skillsErr) {
          console.warn('Failed to load skills:', skillsErr);
        }
      }
    } catch (err: any) {
      console.error('💥 Error loading job data:', err);
      
      let errorMessage = 'Unable to load job details. Please check your internet connection and try again.';
      
      if (err.message?.includes('Database error')) {
        errorMessage = 'There was a problem connecting to our database. Please try again in a moment.';
      } else if (err.message?.includes('Job data error') || err.message?.includes('Job query error')) {
        errorMessage = 'This job posting is no longer available or has been temporarily disabled.';
      } else if (err.message?.includes('Link query error')) {
        errorMessage = 'Invalid or expired recruitment link. Please check the URL and try again.';
      }
      
      setError(errorMessage);
      await checkHealthAndSetStatus();
    } finally {
      setLoading(false);
    }
  };

  const checkHealthAndSetStatus = async () => {
    try {
      const health = await checkRecruitmentHealth();
      setHealthStatus(health);
      console.log('🏥 Health check:', health);
    } catch (healthError) {
      console.error('🏥 Health check failed:', healthError);
      // Set a fallback health status for public access
      setHealthStatus({
        status: 'unknown',
        error: 'Health check unavailable'
      });
    }
  };

  const handleRetry = () => {
    setRetryAttempt(prev => prev + 1);
  };

  const formatSalary = (min?: number, max?: number) => {
    if (!min && !max) return 'Salary negotiable';
    if (min && max) return `Rp${min.toLocaleString()} - ${max.toLocaleString()}`;
    if (min) return `From Rp${min.toLocaleString()}`;
    if (max) return `Up to Rp${max.toLocaleString()}`;
    return 'Salary negotiable';
  };

  const formatSalaryMonthly = (min?: number, max?: number) => {
    if (!min && !max) return '';
    return '[Monthly]';
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: jobData?.job_openings?.job_title,
          text: `Check out this job opportunity: ${jobData?.job_openings?.job_title}`,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  const handleApply = () => {
    setShowApplicationForm(true);
  };

  // Parse benefits from JSONB data
  const getBenefits = (): JobBenefit[] => {
    const benefits = jobData?.job_openings?.benefits;
    if (!benefits) return [];
    
    // If it's already an array, return it
    if (Array.isArray(benefits)) {
      return benefits.filter(benefit => benefit.title && benefit.description);
    }
    
    // If it's a string (shouldn't happen with JSONB, but just in case)
    try {
      const parsed = JSON.parse(benefits as string);
      return Array.isArray(parsed) ? parsed.filter(benefit => benefit.title && benefit.description) : [];
    } catch {
      return [];
    }
  };

  // Enhanced loading state with professional mobile design
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="animate-pulse">
          <div className="h-16 bg-white border-b"></div>
        </div>
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="text-center p-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium text-base">Loading job details...</p>
            <p className="text-base text-gray-500 mt-2">Please wait while we fetch the latest information</p>
            {retryAttempt > 0 && (
              <p className="text-base text-gray-400 mt-1">Attempt {retryAttempt + 1}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Enhanced error state with professional mobile design
  if (error || !jobData || !jobData.job_openings) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="animate-pulse">
          <div className="h-16 bg-white border-b"></div>
        </div>
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4">
          <div className="max-w-md w-full">
            <Card className="shadow-lg">
              <CardContent className="p-6 text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h1 className="text-xl font-bold text-gray-900 mb-2">Job Not Available</h1>
                <p className="text-gray-600 mb-4 text-base">{error}</p>
                
                {healthStatus && (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg text-left">
                    <p className="text-base text-gray-500 mb-1">System Status:</p>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${healthStatus.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className="text-base">{healthStatus.status === 'healthy' ? 'System Operational' : 'System Issues Detected'}</span>
                    </div>
                    {healthStatus.active_recruitment_links !== undefined && (
                      <p className="text-base text-gray-400 mt-1">
                        Active Links: {healthStatus.active_recruitment_links} | Active Jobs: {healthStatus.active_job_openings}
                      </p>
                    )}
                  </div>
                )}
                
                <div className="flex flex-col gap-2">
                  {retryAttempt < 3 && (
                    <Button onClick={handleRetry} variant="outline" className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Try Again
                    </Button>
                  )}
                  
                  <Button 
                    onClick={() => window.location.href = '/'} 
                    variant="default"
                  >
                    Back to Home
                  </Button>
                </div>
                
                {retryAttempt >= 3 && (
                  <Alert className="mt-4">
                    <AlertDescription className="text-base">
                      If this problem persists, please contact the company directly or check back later.
                      <br />
                      <span className="text-base text-gray-500 mt-1 block">Token: {token}</span>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const job = jobData.job_openings;
  
  // Properly type the company object with all required fields using type assertion
  const organizationData = job.organizations as any; // Type assertion to access additional properties
  const company: CompanyData = {
    company_name: organizationData?.company_name || 'Company',
    industry: organizationData?.industry || 'Technology',
    address: organizationData?.address || '',
    website: organizationData?.website || '',
    email: organizationData?.email || '',
    description: organizationData?.description || '',
    about_us: organizationData?.about_us || ''
  };

  // Parse requirements and responsibilities into bullet points
  const parseTextToList = (text: string | undefined) => {
    if (!text) return [];
    return text.split('\n').filter(line => line.trim()).map(line => line.trim().replace(/^\d+\.\s*/, ''));
  };

  const requirements = parseTextToList(job.requirements);
  const responsibilities = parseTextToList(job.responsibilities);
  const benefits = getBenefits();
  const jobDescriptionItems = parseTextToList(job.job_description);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{company.company_name}</h2>
              {company.industry && (
                <p className="text-sm text-gray-600">{company.industry}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content with mobile-optimized spacing and sticky button padding */}
      <div className={`max-w-7xl mx-auto ${isMobile ? 'px-4 py-4 pb-24' : 'px-2 sm:px-3 lg:px-4 py-6 lg:py-8'}`}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 lg:gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-2">
            {/* Job Header - Mobile Optimized */}
            <Card className="shadow-sm">
              <CardContent className={isMobile ? "p-4" : "p-4 sm:p-6"}>
                <div className="space-y-3">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 leading-tight">
                      {job.job_title || 'Job Position'}
                    </h1>
                    <div className="flex items-center text-lg sm:text-xl text-gray-700 mb-2">
                      <CompanyLogo companyName={company.company_name} size="sm" />
                      <span className="truncate ml-2">{company.company_name}</span>
                    </div>
                    
                    {/* Mobile-first layout for job details */}
                    <div className="space-y-1 sm:space-y-0 sm:flex sm:flex-wrap sm:items-center sm:gap-4 text-base text-gray-600 mb-3">
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span>{job.location || 'Remote'}</span>
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span>{job.posted_date ? new Date(job.posted_date).toLocaleDateString() : 'Recently posted'}</span>
                      </div>
                    </div>

                    {/* Tags - Mobile friendly */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {job.departments && (
                        <Badge variant="secondary" className="text-sm px-2 py-1">{job.departments.name}</Badge>
                      )}
                      {job.job_levels && (
                        <Badge variant="secondary" className="text-sm px-2 py-1">{job.job_levels.name}</Badge>
                      )}
                      {job.employee_statuses && (
                        <Badge variant="secondary" className="text-sm px-2 py-1">{job.employee_statuses.name}</Badge>
                      )}
                    </div>

                    {/* Salary - Mobile prominent */}
                    <div className="text-xl sm:text-2xl font-bold text-blue-600 mb-3">
                      {formatSalary(job.salary_min, job.salary_max)} {formatSalaryMonthly(job.salary_min, job.salary_max)}
                    </div>
                  </div>

                  {/* Action Buttons - Desktop only, mobile will be sticky */}
                  {!isMobile && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button 
                        className="bg-blue-600 hover:bg-blue-700 flex-1 h-10 text-base font-medium"
                        onClick={handleApply}
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Apply Now
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={handleShare} 
                        className="h-10 sm:w-auto text-base"
                      >
                        <Share2 className="h-4 w-4 mr-2" />
                        Share
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Job Description - parsed list so numbering is always 1, 2, 3... */}
            {job.job_description && (
              <Card className="shadow-sm">
                <CardContent className={isMobile ? "p-4" : "p-4 sm:p-6"}>
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3">Job Description</h2>
                  <div className="prose prose-sm max-w-none text-gray-700">
                    {jobDescriptionItems.length === 0 ? (
                      <p className="whitespace-pre-wrap leading-relaxed text-base">{job.job_description}</p>
                    ) : jobDescriptionItems.length === 1 ? (
                      <p className="leading-relaxed text-base">{jobDescriptionItems[0]}</p>
                    ) : (
                      <ol className="list-decimal list-outside pl-5 sm:pl-6 space-y-2 text-base leading-relaxed">
                        {jobDescriptionItems.map((item, index) => (
                          <li key={index} className="pl-1">{item}</li>
                        ))}
                      </ol>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Requirements */}
            {requirements.length > 0 && (
              <Card className="shadow-sm">
                <CardContent className={isMobile ? "p-4" : "p-4 sm:p-6"}>
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3">Requirements</h2>
                  <ol className="space-y-2 text-gray-700">
                    {requirements.map((requirement, index) => (
                      <li key={index} className="flex text-base">
                        <span className="mr-2 flex-shrink-0">{index + 1}.</span>
                        <span>{requirement}</span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            )}

            {/* Responsibilities */}
            {responsibilities.length > 0 && (
              <Card className="shadow-sm">
                <CardContent className={isMobile ? "p-4" : "p-4 sm:p-6"}>
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3">Responsibilities</h2>
                  <ol className="space-y-2 text-gray-700">
                    {responsibilities.map((responsibility, index) => (
                      <li key={index} className="flex text-base">
                        <span className="mr-2 flex-shrink-0">{index + 1}.</span>
                        <span>{responsibility}</span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            )}

            {/* Dynamic Benefits Section */}
            {benefits.length > 0 && (
              <Card className="shadow-sm">
                <CardContent className={isMobile ? "p-4" : "p-4 sm:p-6"}>
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3">Benefits</h2>
                  <div className="space-y-3">
                    {benefits.map((benefit, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
                          <div className="w-2.5 h-2.5 bg-blue-600 rounded-full"></div>
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900 text-base">{benefit.title}</h3>
                          <p className="text-base text-gray-600 mt-1">{benefit.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - Mobile adapted */}
          <div className="space-y-2">
            {/* Company Info - Mobile optimized */}
            <Card className="shadow-sm">
              <CardContent className={isMobile ? "p-4" : "p-4 sm:p-6"}>
                  <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <CompanyLogo companyName={company.company_name} />
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 text-base truncate">{company.company_name}</h3>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2 text-base mb-3">
                  <div className="flex items-center text-gray-600">
                    <Users className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span>Growing Company</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <CompanyLogo companyName={company.company_name} size="sm" />
                    <span className="ml-2">Professional Environment</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Globe className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span>{company.industry}</span>
                  </div>
                </div>

                <div className="pt-3 border-t">
                  <button className="text-gray-500 hover:text-gray-700 text-base flex items-center">
                    <span className="mr-1">🚩</span>
                    Report this job
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* About Company Section */}
            <Card className="shadow-sm">
              <CardContent className={isMobile ? "p-4" : "p-4 sm:p-6"}>
                <h3 className="font-bold text-gray-900 text-base mb-3">About Company</h3>
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-gray-900 text-base">{company.company_name}</h4>
                    <p className="text-base text-gray-600 mt-2 leading-relaxed">
                      {/* Prioritize about_us over description */}
                      {company.about_us || company.description || `${company.company_name} is a leading company in the ${company.industry} industry, committed to innovation and excellence.`}
                    </p>
                  </div>
                  
                  <div className="space-y-2 text-base">
                    <div className="flex items-start text-gray-600">
                      <CompanyLogo companyName={company.company_name} size="sm" />
                      <span className="ml-2">Industry: {company.industry}</span>
                    </div>
                    {company.address && (
                      <div className="flex items-start text-gray-600">
                        <MapPin className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
                        <span>{company.address}</span>
                      </div>
                    )}
                    {company.website && (
                      <div className="flex items-start text-gray-600">
                        <Globe className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
                        <a 
                          href={company.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline"
                        >
                          Visit Website
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Safety Reminder - Mobile adapted */}
            <Card className="bg-blue-50 border-blue-200 shadow-sm">
              <CardContent className={isMobile ? "p-4" : "p-4 sm:p-6"}>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
                    <span className="text-white text-sm">✓</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-blue-900 mb-2 text-base">Safety Reminder</h4>
                    <div className="text-base text-blue-800 space-y-2">
                      <p>If the position requires you to work overseas, please be vigilant and beware of fraud.</p>
                      <p>If you encounter an employer who has the following actions during your job search, please report it immediately:</p>
                      <ul className="list-disc list-inside space-y-1 text-base">
                        <li>withholds your ID,</li>
                        <li>requires you to provide a guarantee or collects property,</li>
                        <li>forces you to invest or raise funds,</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Sticky Action Buttons for Mobile */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 shadow-lg z-40">
          <div className="max-w-md mx-auto flex gap-2">
            <Button 
              className="bg-blue-600 hover:bg-blue-700 flex-1 h-12 text-base font-medium"
              onClick={handleApply}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Apply Now
            </Button>
            <Button 
              variant="outline" 
              onClick={handleShare} 
              className="h-12 px-4 text-base border-gray-300"
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="bg-gray-900 text-white mt-12">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-semibold mb-2">{company.company_name}</h3>
              {company.address && <p className="text-sm text-gray-400">{company.address}</p>}
            </div>
            {company.website && (
              <div>
                <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-400 hover:text-white">
                  {company.website}
                </a>
              </div>
            )}
            {company.email && (
              <div>
                <a href={`mailto:${company.email}`} className="text-sm text-gray-400 hover:text-white">
                  {company.email}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Application Form Modal - Updated with proper modal styling */}
      {showApplicationForm && jobData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto bg-white rounded-lg">
            <ApplicationForm
              jobId={jobData.job_opening_id}
              jobTitle={job.job_title || 'Job Position'}
              companyName={company.company_name}
              recruitmentLinkId={jobData.id}
              recruitmentToken={jobData.token}
              organizationId={jobData.organization_id}
              requiredSkills={requiredSkills}
              onClose={() => setShowApplicationForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default JobPreview;
