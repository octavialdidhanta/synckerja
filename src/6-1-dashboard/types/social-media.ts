
export interface ContentPlan {
  id: string;
  organization_id: string;
  post_date: string | null;
  content_type_id: string | null;
  pic_id: string | null;
  service_id: string | null;
  sub_service_id: string | null;
  title: string | null;
  content_pillar_id: string | null;
  brief: string | null;
  status: string;
  revision_count: number;
  approved: boolean;
  completion_date: string | null;
  pic_production_id: string | null;
  pic_production_source: 'task_steps_assigned' | 'google_drive_link' | null;
  google_drive_link: string | null;
  /** Snapshot of google_drive_link when production_status became Request Revision (DB trigger + app reads). */
  production_revision_baseline_link?: string | null;
  production_status: string | null;
  production_revision_count: number;
  production_completion_date: string | null;
  production_approved: boolean;
  production_approved_date: string | null;
  post_link: any | null; // Changed from Record<string, string> to any to handle Json type
  post_link_created_by: string | null; // Employee who added the first post link
  done: boolean;
  actual_post_date: string | null;
  on_time_status: string;
  status_content: string;
  created_at: string;
  updated_at: string;
  content_type?: {
    id: string;
    name: string;
  };
  service?: {
    id: string;
    name: string;
  };
  sub_service?: {
    id: string;
    name: string;
  };
  content_pillar?: {
    id: string;
    name: string;
    color?: string;
  };
  pic?: {
    id: string;
    full_name: string;
  };
  pic_production?: {
    id: string;
    full_name: string;
  };
  post_link_creator?: {
    id: string;
    full_name: string;
  };
}

export interface ContentType {
  id: string;
  name: string;
  description?: string;
  organization_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  organization_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubService {
  id: string;
  name: string;
  description?: string;
  service_id: string;
  organization_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContentPillar {
  id: string;
  name: string;
  description?: string;
  color?: string;
  funnel_stage?: string;
  organization_id?: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContentManager {
  id: string;
  name: string;
  pic: string;
  target: number;
  actual: number;
  percentage: number;
  dailyTarget?: number;
  monthlyTarget?: number;
  targetAdjusted?: number;
  /** Monthly actual count vs target (same month as column picker) */
  currentValue?: number;
  hasTarget?: boolean;
  targetStatus?: string;
  progress?: number;
  /** Percentage, or null when there is no monthly sample to measure */
  onTimeRate?: number | null;
  /** Percentage, or null when there is no monthly sample (Content Post only) */
  effectiveRate?: number | null;
  score?: number;
}

export interface SocialMediaMetrics {
  dailyOverdueContent: number;
  dailyCompletedContent: number;
  dailyRevisedContent: number;
  dailyTotalContent: number;
  monthlyOverdueContent: number;
  monthlyCompletedContent: number;
  monthlyRevisedContent: number;
  monthlyTotalContent: number;
}

export interface HolidayEvent {
  date: Date;
  name: string;
  type: 'national' | 'international' | 'religious';
  description?: string;
}

export interface PillarData {
  pillar_id: string;
  pillar_name: string;
  count: number;
  funnel: 'top' | 'middle' | 'bottom';
  previousMonthCount?: number;
  isDefault: boolean;
}
