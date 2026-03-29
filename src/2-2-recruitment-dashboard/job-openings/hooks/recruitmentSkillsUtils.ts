
import { supabase } from '@/shared/lib/supabaseClient';
import { getCurrentOrganizationId } from '@/shared/auth/hooks/useCurrentOrg';
import { RecruitmentSkill, RecruitmentSkillFormData } from './recruitmentSkillsTypes';

export const createRecruitmentSkill = async (
  jobOpeningId: string, 
  data: RecruitmentSkillFormData
): Promise<RecruitmentSkill> => {
  const { organizationId } = await getCurrentOrganizationId();
  
  const { data: skill, error } = await supabase
    .from('recruitment_skills')
    .insert({
      ...data,
      job_opening_id: jobOpeningId,
      organization_id: organizationId
    })
    .select()
    .single();

  if (error) throw error;
  
  // Type assertion to ensure TypeScript knows the skill_level is the correct type
  return {
    ...skill,
    skill_level: skill.skill_level as 'beginner' | 'intermediate' | 'advanced' | 'expert'
  };
};

export const updateRecruitmentSkill = async (
  id: string, 
  data: Partial<RecruitmentSkillFormData>
): Promise<RecruitmentSkill> => {
  const { data: skill, error } = await supabase
    .from('recruitment_skills')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  
  // Type assertion to ensure TypeScript knows the skill_level is the correct type
  return {
    ...skill,
    skill_level: skill.skill_level as 'beginner' | 'intermediate' | 'advanced' | 'expert'
  };
};

export const deleteRecruitmentSkill = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('recruitment_skills')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const fetchRecruitmentSkills = async (jobOpeningId: string): Promise<RecruitmentSkill[]> => {
  const { data: skills, error } = await supabase
    .from('recruitment_skills')
    .select('*')
    .eq('job_opening_id', jobOpeningId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  
  // Type assertion to ensure TypeScript knows the skill_level is the correct type
  return (skills || []).map(skill => ({
    ...skill,
    skill_level: skill.skill_level as 'beginner' | 'intermediate' | 'advanced' | 'expert'
  }));
};

export const uploadRecruitmentFile = async (file: File, folder = 'cvs'): Promise<string> => {
  const fileName = `${folder}/${Date.now()}-${file.name}`;
  
  const { data, error } = await supabase.storage
    .from('recruitment-files')
    .upload(fileName, file);

  if (error) throw error;
  return data.path;
};

export const getFileUrl = (filePath: string): string => {
  const { data } = supabase.storage
    .from('recruitment-files')
    .getPublicUrl(filePath);
  
  return data.publicUrl;
};
