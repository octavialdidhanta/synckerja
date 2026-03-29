
export interface RecruitmentSkill {
  id: string;
  job_opening_id: string;
  title: string;
  description?: string;
  is_required: boolean;
  skill_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  organization_id?: string;
  created_at: string;
  updated_at: string;
}

export interface RecruitmentSkillFormData {
  title: string;
  description?: string;
  is_required: boolean;
  skill_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

export interface JobApplicationSkill {
  title: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  skill_level?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  is_required?: boolean;
  experience_years?: number;
}
