
import { supabase } from '@/shared/lib/supabaseClient';
import { getCurrentOrganizationId } from '@/shared/auth/hooks/useCurrentOrg';
import { RecruitmentLink, CreateRecruitmentLinkData } from './recruitmentLinkTypes';
import { JobBenefit } from './jobOpeningTypes';
import { incrementJobClicks } from './jobOpeningUtils';
import { safeJSONParse } from '@/shared/hooks/optimizedHelpers';

// Helper function to safely convert Json to JobBenefit[]
const parseJobBenefits = (benefits: any): JobBenefit[] => {
  if (!benefits) return [];
  if (Array.isArray(benefits)) return benefits;
  return safeJSONParse(benefits, []);
};


// Generate a unique token for recruitment links
export const generateRecruitmentToken = (): string => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 15);
  return `${timestamp}_${randomStr}`;
};

export const createRecruitmentLink = async (data: CreateRecruitmentLinkData): Promise<RecruitmentLink> => {
  const { organizationId } = await getCurrentOrganizationId();
  const user = await supabase.auth.getUser();
  
  const linkData = {
    ...data,
    organization_id: organizationId,
    created_by: user.data.user?.id,
    preview_link: `${window.location.origin}/apply/preview/${data.token}`,
  };
  
  const { data: recruitmentLink, error } = await supabase
    .from('recruitment_links')
    .insert(linkData)
    .select()
    .single();

  if (error) throw error;
  return (recruitmentLink as unknown) as RecruitmentLink;
};

export const getRecruitmentLinkByJobId = async (jobOpeningId: string): Promise<RecruitmentLink | null> => {
  const { organizationId } = await getCurrentOrganizationId();
  
  const { data, error } = await supabase
    .from('recruitment_links')
    .select('*')
    .eq('job_opening_id', jobOpeningId)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown) as RecruitmentLink | null;
};

// Optimized function using the new database function
export const getJobByToken = async (token: string): Promise<RecruitmentLink | null> => {
    console.log('Fetching job data for token:', token);
  
  try {
    const rpcName: any = 'get_job_by_recruitment_token';
    const { data, error } = await supabase.rpc(rpcName, {
      token_param: token
    });

    if (error) {
      console.error('Database function error:', error);
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data) {
      console.warn('No recruitment link found for token:', token);
      const emptyResult: RecruitmentLink | null = null;
      return emptyResult;
    }

    console.log('Job data fetched successfully');
    
    // Parse benefits from the job_openings data
    if (data.job_openings?.benefits) {
      data.job_openings.benefits = parseJobBenefits(data.job_openings.benefits);
    }
    
    return data as RecruitmentLink;

  } catch (error) {
    console.error('Error in getJobByToken:', error);
    return await getJobByTokenFallback(token);
  }
};

// Simplified fallback method - make it public access
async function getJobByTokenFallback(token: string): Promise<RecruitmentLink | null> {
  console.log('Using fallback query for token:', token);

  try {
    const selectQuery = '*,job_openings!inner(*,organizations(company_name,industry,address,website,description),departments(name),job_positions(name),job_levels(name),employee_statuses(name))';

    const queryResult = await supabase
      .from('recruitment_links')
      .select(selectQuery)
      .eq('token', token)
      .eq('status', 'active')
      .maybeSingle();

    if (queryResult.error || !queryResult.data) {
      console.error('Error fetching recruitment link:', queryResult.error);
      return null;
    }

    const linkDataUnknown: unknown = queryResult.data;
    const linkDataObj: Record<string, unknown> = linkDataUnknown as Record<string, unknown>;

    const expiresAt = linkDataObj.expires_at;
    if (expiresAt && typeof expiresAt === 'string' && new Date(expiresAt) < new Date()) {
      console.warn('Recruitment link has expired');
      return null;
    }

    const jobData = linkDataObj.job_openings;
    
    if (!jobData || typeof jobData !== 'object' || jobData === null) {
      console.warn('No active job found');
      return null;
    }

    const jobDataObj: Record<string, unknown> = jobData as Record<string, unknown>;

    // Increment clicks asynchronously - ignore errors for public access
    try {
      const jobIdValue = jobDataObj.id;
      const linkIdValue = linkDataObj.id;
      if (typeof jobIdValue === 'string' && typeof linkIdValue === 'string') {
        void Promise.all([
          incrementJobClicks(jobIdValue).catch(() => {}),
          incrementRecruitmentLinkClicks(linkIdValue).catch(() => {})
        ]).catch(() => {});
      }
    } catch {
      // Ignore click tracking errors
    }

    // Return the data with proper structure
    const linkStatusValue = linkDataObj.status;
    const linkStatus = linkStatusValue === 'active' || linkStatusValue === 'inactive' 
      ? linkStatusValue 
      : 'active';

    const jobIdFinal = typeof jobDataObj.id === 'string' ? jobDataObj.id : '';

    const result: RecruitmentLink = {
      ...linkDataObj,
      status: linkStatus,
      job_openings: {
        ...jobDataObj,
        id: jobIdFinal,
        benefits: parseJobBenefits(jobDataObj.benefits),
        organizations: jobDataObj.organizations || {
          company_name: 'Company Name',
          industry: 'Technology',
          address: '',
          website: '',
          description: ''
        },
        departments: jobDataObj.departments || { name: 'General' },
        job_positions: jobDataObj.job_positions || { name: 'Position' },
        job_levels: jobDataObj.job_levels || { name: 'Level' },
        employee_statuses: jobDataObj.employee_statuses || { name: 'Full-time' }
      }
    } as RecruitmentLink;

    return result;
  } catch (error) {
    console.error('Error in fallback method:', error);
    return null;
  }
}

export const incrementRecruitmentLinkClicks = async (linkId: string): Promise<void> => {
  const rpcName: any = 'increment_recruitment_link_clicks';
  const { error } = await supabase.rpc(rpcName, { link_id: linkId });
  if (error) {
    console.error('Error incrementing recruitment link clicks:', error);
    throw error;
  }
};

export const incrementRecruitmentLinkSubmissions = async (linkId: string): Promise<void> => {
  const rpcName: any = 'increment_recruitment_link_submissions';
  const { error } = await supabase.rpc(rpcName, { link_id: linkId });
  if (error) {
    console.error('Error incrementing recruitment link submissions:', error);
    throw error;
  }
};

export const getRecruitmentLinkAnalytics = async (): Promise<any> => {
  const { organizationId } = await getCurrentOrganizationId();
  
  const { data, error } = await supabase
    .from('recruitment_links')
    .select(`
      id,
      clicks,
      submissions,
      job_openings!inner(job_title)
    `)
    .eq('organization_id', organizationId)
    .eq('status', 'active');

  if (error) throw error;

  const dataArray = (data as unknown) as Array<{
    id: string;
    clicks?: number;
    submissions?: number;
    job_openings?: { job_title?: string };
  }> | null;

  const totalClicks = dataArray?.reduce((sum, link) => sum + (link.clicks || 0), 0) || 0;
  const totalSubmissions = dataArray?.reduce((sum, link) => sum + (link.submissions || 0), 0) || 0;

  return {
    total_clicks: totalClicks,
    total_submissions: totalSubmissions,
    conversion_rate: totalClicks ? (totalSubmissions / totalClicks * 100) : 0,
    top_performing_links: dataArray?.map(link => ({
      id: link.id,
      job_title: link.job_openings?.job_title || 'Unknown',
      clicks: link.clicks || 0,
      submissions: link.submissions || 0,
      conversion_rate: link.clicks ? ((link.submissions || 0) / link.clicks * 100) : 0
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 5) || []
  };
};

export const checkRecruitmentHealth = async (): Promise<any> => {
  try {
    // Public health check - don't require authentication
    const [linksResult, jobsResult] = await Promise.allSettled([
      supabase
        .from('recruitment_links')
        .select('id')
        .eq('status', 'active'),
      supabase
        .from('job_openings')
        .select('id')
        .eq('status', 'active')
    ]);

    const activeLinks = linksResult.status === 'fulfilled' ? linksResult.value.data?.length || 0 : 0;
    const activeJobs = jobsResult.status === 'fulfilled' ? jobsResult.value.data?.length || 0 : 0;

    return {
      status: 'healthy',
      active_recruitment_links: activeLinks,
      active_job_openings: activeJobs
    };
  } catch (error) {
    console.error('Health check failed:', error);
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

export const buildRecruitmentLinkQueryKey = (jobOpeningId?: string) => {
  return jobOpeningId ? ['recruitment_links', jobOpeningId] : ['recruitment_links'];
};
