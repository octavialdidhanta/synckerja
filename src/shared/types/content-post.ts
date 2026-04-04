export type ContentPostStatus = "draft" | "posted" | "archived";
export type PaymentModel = "fixed" | "performance_based" | "barter_plus_fee";
export type PaymentSchedule = "immediate" | "net_30" | "net_60" | "milestone_based";

export interface KOLCampaignAssignmentOption {
  id: string;
  campaign_id: string;
  kol_profile_id: string;
  campaign?: {
    id: string;
    name: string;
    status?: string | null;
  } | null;
  kol_profile?: {
    id: string;
    name: string;
    profile_photo_url?: string | null;
  } | null;
}

export interface ContentPostRecord {
  id: string;
  campaign_assignment_id: string;
  campaign_id?: string | null;
  kol_profile_id?: string | null;
  organization_id?: string | null;
  campaign_deliverable_id?: string | null;
  title?: string | null;
  platform: string;
  content_type?: string | null;
  status: ContentPostStatus | string;
  post_url?: string | null;
  post_date?: string | null;
  caption?: string | null;
  hashtags?: string[] | null;
  mentions?: string[] | null;
  created_at?: string;
  updated_at?: string;
  campaign?: {
    id: string;
    name: string;
  } | null;
  kol_profile?: {
    id: string;
    name: string;
    profile_photo_url?: string | null;
  } | null;
}

export interface PaymentMilestoneRecord {
  id: string;
  payment_terms_id: string;
  milestone_name: string;
  milestone_order: number;
  percentage: number;
  amount: number;
  due_date?: string | null;
  status?: string | null;
  milestone_description?: string | null;
  trigger_condition?: string | null;
  trigger_details?: Record<string, unknown> | null;
  invoice_uploaded?: boolean | null;
  invoice_file_path?: string | null;
}

export interface PerformanceThresholdInput {
  metric: "reach" | "engagement" | "conversion";
  threshold: number;
  bonus_percentage: number;
}

export interface ContentPostMilestoneInput {
  milestone_name: string;
  payment_percentage: number;
  amount: number;
  due_date?: string | null;
  milestone_description?: string | null;
  milestone_order: number;
  status?: string;
  trigger_condition?: string;
  trigger_details?: Record<string, unknown>;
  /** Optional file from create modal; not persisted by edge/client insert path. */
  invoice_file?: File | null;
}

export interface CreateContentPostPayload {
  campaign_assignment_id: string;
  campaign_id: string;
  kol_profile_id: string;
  organization_id: string;
  title: string;
  platform: string;
  content_type: string;
  post_url?: string | null;
  post_date?: string | null;
  caption?: string | null;
  hashtags?: string[] | null;
  mentions?: string[] | null;
  status: ContentPostStatus;
}

export interface CreateContentPostWithPaymentPayload extends CreateContentPostPayload {
  paymentTermsData: {
    /** Parity with reference payload shape (`content_post`). */
    type?: string;
    payment_model: PaymentModel;
    base_amount: number;
    barter_value?: number | null;
    payment_schedule: PaymentSchedule;
    milestones: ContentPostMilestoneInput[];
    performance_thresholds?: PerformanceThresholdInput[];
    /** Same as reference payload; redundant with root `kol_profile_id` but kept for parity. */
    kol_profile_id?: string;
  };
}
