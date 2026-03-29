
import { JobBenefit } from './jobOpeningTypes';

export type RecruitmentLink = {
  id: string;
  job_opening_id: string;
  organization_id: string;
  token: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  expires_at?: string;
  created_by?: string;
  clicks?: number;
  submissions?: number;
  department_id?: string;
  preview_link?: string;
  job_openings?: {
    id: string;
    job_title: string;
    location?: string;
    salary_min?: number;
    salary_max?: number;
    job_description?: string;
    requirements?: string;
    responsibilities?: string;
    benefits?: JobBenefit[];
    status: string;
    posted_date?: string;
    closing_date?: string;
    organizations?: {
      company_name: string;
      industry: string;
      address: string;
      website?: string;
      description?: string;
    };
    departments?: {
      name: string;
    };
    job_positions?: {
      name: string;
    };
    job_levels?: {
      name: string;
    };
    employee_statuses?: {
      name: string;
    };
  };
};

export interface CreateRecruitmentLinkData {
  job_opening_id: string;
  token: string;
  created_by?: string;
  department_id?: string;
  preview_link?: string;
}

export interface RecruitmentLinkAnalytics {
  total_clicks: number;
  total_submissions: number;
  conversion_rate: number;
  top_performing_links: Array<{
    id: string;
    job_title: string;
    clicks: number;
    submissions: number;
    conversion_rate: number;
  }>;
}
