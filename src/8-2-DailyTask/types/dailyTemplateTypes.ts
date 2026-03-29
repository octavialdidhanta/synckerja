/** Same as SOP: days_before_h, hari_h, working_days_after_h. Used when template mode is Hari H. */
export type DailyTemplateScheduleType = 'days_before_h' | 'hari_h' | 'working_days_after_h';

export interface DailyTemplate {
  id: string;
  organization_id: string;
  name: string;
  department_id: string | null;
  hari_h_date: string | null; // ISO date (YYYY-MM-DD)
  created_at?: string;
  updated_at?: string;
}

export interface DailyTemplateStep {
  id: string;
  daily_template_id: string;
  order: number;
  title: string;
  description: string | null;
  schedule_type: DailyTemplateScheduleType | null;
  schedule_value: number | null;
  step_priority: number | null; // Urutan step; dipakai untuk sort di tanggal yang sama (angka >= 1)
  created_at?: string;
  updated_at?: string;
}

export interface DailyTemplateCreate {
  organization_id: string;
  name: string;
  department_id?: string | null;
  hari_h_date?: string | null;
}

export interface DailyTemplateStepCreate {
  daily_template_id: string;
  order: number;
  title: string;
  description?: string | null;
  schedule_type?: DailyTemplateScheduleType | null;
  schedule_value?: number | null;
  step_priority?: number | null;
}

export interface DailyTemplateStepUpdate {
  order?: number;
  title?: string;
  description?: string | null;
  schedule_type?: DailyTemplateScheduleType | null;
  schedule_value?: number | null;
  step_priority?: number | null;
}

export type DailyTemplateMode = 'hari_h' | 'prioritas';
