
export interface EmployeeTarget {
  id: string;
  organization_id: string;
  employee_id: string;
  target_type: 'content_planning' | 'content_production' | 'content_posting' | 'sales';
  target_category: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  start_date: string;
  end_date: string;
  target_value: number;
  current_value: number;
  progress_percentage: number;
  status: 'active' | 'completed' | 'cancelled' | 'overdue';
  description?: string;
  metadata: Record<string, any>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TargetProgressLog {
  id: string;
  target_id: string;
  previous_value: number;
  new_value: number;
  change_amount: number;
  change_reason: 'manual_update' | 'auto_calculation' | 'achievement' | 'correction';
  logged_by: string;
  logged_at: string;
  notes?: string;
}

export interface CreateEmployeeTargetRequest {
  employee_id: string;
  target_type: EmployeeTarget['target_type'];
  target_category: EmployeeTarget['target_category'];
  start_date: string;
  end_date: string;
  target_value: number;
  description?: string;
  metadata?: Record<string, any>;
}

export interface UpdateEmployeeTargetRequest {
  target_value?: number;
  current_value?: number;
  description?: string;
  metadata?: Record<string, any>;
}
