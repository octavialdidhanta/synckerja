export type OkrPeriodType = 'yearly' | 'half_yearly' | 'quarterly';
export type OkrLevel = 'company' | 'department' | 'individual';
export type KrMetricType = 'percentage' | 'number' | 'currency' | 'boolean';
export type KrCalculationType = 'increase' | 'decrease' | 'maintain';
export type OkrStatus = 'draft' | 'active' | 'completed' | 'cancelled' | 'paused';
export type CheckinStatus = 'on_track' | 'at_risk' | 'off_track';
export type DeductionType = 'fixed_amount' | 'percentage';
export type WeightStatus = 'pending' | 'approved' | 'rejected';

export interface OkrCycle {
  id: string;
  organization_id: string;
  name: string;
  year: number;
  period_type: OkrPeriodType;
  quarter?: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface Objective {
  id: string;
  organization_id: string;
  cycle_id: string;
  title: string;
  description?: string;
  why_important: string;
  level: OkrLevel;
  owner_id: string;
  parent_objective_id?: string;
  department_id?: string;
  entity_id?: string;
  status: OkrStatus;
  progress_percentage: number;
  weight: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  derived_from_kr_id?: string; // New field for tracking objectives derived from KRs
  key_results?: KeyResult[];
  parent_objective?: Objective;
  child_objectives?: Objective[];
}

export interface KeyResult {
  id: string;
  organization_id: string;
  objective_id: string;
  title: string;
  description?: string;
  metric_type: KrMetricType;
  calculation_type: KrCalculationType;
  start_value: number;
  target_value: number;
  current_value: number;
  unit?: string;
  weight: number;
  progress_percentage: number;
  is_inverse: boolean;
  owner_level: OkrLevel;
  created_at: string;
  updated_at: string;
  created_by: string;
  created_by_department_id?: string;
  department_id?: string;
  converted_to_objective_id?: string; // New field for tracking conversions
  conversion_date?: string; // New field for tracking when conversion happened
  objective?: Objective;
  converted_objective?: Objective | null; // New field for the objective this KR was converted to
  weekly_checkins?: WeeklyCheckin[];
}

// Alignment is handled via parent_objective_id in objectives table

export interface OkrConversionHistory {
  id: string;
  organization_id: string;
  source_type: 'key_result' | 'objective';
  source_id: string;
  target_type: 'objective' | 'key_result';
  target_id: string;
  conversion_reason?: string;
  converted_by: string;
  conversion_date: string;
  metadata?: any;
}

export interface WeeklyCheckin {
  id: string;
  organization_id: string;
  key_result_id: string;
  employee_id: string;
  week_start_date: string;
  current_value: number;
  confidence_level: number;
  status: CheckinStatus;
  comments?: string;
  blockers?: string;
  created_at: string;
}

export interface ProgressCalculation {
  id: string;
  organization_id: string;
  key_result_id: string;
  calculation_date: string;
  expected_progress: number;
  actual_progress: number;
  variance: number;
  is_on_track: boolean;
  created_at: string;
}

export interface MonthlyDeduction {
  id: string;
  organization_id: string;
  employee_id: string;
  cycle_id: string;
  month: number;
  year: number;
  key_result_id?: string;
  deduction_type: DeductionType;
  deduction_amount: number;
  reason: string;
  is_processed: boolean;
  processed_at?: string;
  created_at: string;
  created_by: string;
}

export interface MonthlyIncentive {
  id: string;
  organization_id: string;
  employee_id: string;
  cycle_id: string;
  month: number;
  year: number;
  key_result_id?: string;
  incentive_amount: number;
  achievement_percentage: number;
  reason: string;
  
  is_processed: boolean;
  processed_at?: string;
  created_at: string;
  created_by: string;
}

export interface DynamicWeight {
  id: string;
  organization_id: string;
  key_result_id: string;
  base_weight: number;
  requested_weight?: number;
  final_weight: number;
  adjustment_reason?: string;
  status: WeightStatus;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  created_by: string;
}

export interface CrossDeptDependency {
  id: string;
  organization_id: string;
  dependent_kr_id: string;
  dependency_kr_id: string;
  dependency_type: string;
  impact_level: number;
  status: string;
  created_at: string;
  created_by: string;
}

export interface DependencyHealthScore {
  id: string;
  organization_id: string;
  dependency_id: string;
  health_score: number;
  risk_level: string;
  blocker_owner?: string;
  estimated_delay_days?: number;
  impact_description?: string;
  calculated_at: string;
}

export interface GamificationPoint {
  id: string;
  organization_id: string;
  employee_id: string;
  cycle_id: string;
  points: number;
  reason: string;
  key_result_id?: string;
  created_at: string;
}

export interface OkrTemplate {
  id: string;
  organization_id?: string;
  name: string;
  level: OkrLevel;
  objective_template: string;
  key_results_template: any;
  is_global: boolean;
  created_at: string;
  created_by: string;
}

export interface OkrReview {
  id: string;
  organization_id: string;
  objective_id: string;
  reviewer_id: string;
  review_type: string;
  status: string;
  comments?: string;
  score?: number;
  created_at: string;
}


export interface CreateObjectiveData {
  title: string;
  description?: string;
  why_important: string;
  level: OkrLevel;
  owner_id: string;
  parent_objective_id?: string;
  department_id?: string;
}

export interface CreateKeyResultData {
  title: string;
  description?: string;
  metric_type: KrMetricType;
  calculation_type: KrCalculationType;
  start_value: number;
  target_value: number;
  unit?: string;
  is_inverse?: boolean;
}

export interface CreateCheckinData {
  current_value: number;
  confidence_level: number;
  status: CheckinStatus;
  comments?: string;
  blockers?: string;
}
