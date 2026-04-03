export type SopScheduleType = "days_before_h" | "hari_h" | "working_days_after_h";

export interface SopTemplate {
  id: string;
  default_price_id: string;
  organization_id: string;
  name: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SopTemplateStep {
  id: string;
  sop_template_id: string;
  order: number;
  title: string;
  description: string | null;
  schedule_type: SopScheduleType;
  schedule_value: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface SopTemplateCreate {
  default_price_id: string;
  organization_id: string;
  name?: string | null;
}

export interface SopTemplateStepCreate {
  sop_template_id: string;
  order: number;
  title: string;
  description?: string | null;
  schedule_type: SopScheduleType;
  schedule_value?: number | null;
}

export interface SopTemplateStepUpdate {
  order?: number;
  title?: string;
  description?: string | null;
  schedule_type?: SopScheduleType;
  schedule_value?: number | null;
}
