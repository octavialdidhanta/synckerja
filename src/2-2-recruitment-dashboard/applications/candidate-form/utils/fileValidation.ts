
export const validateRequiredSkills = (
  skills: Array<{ title: string }>,
  requiredSkills: Array<{ title: string; skill_level: string; is_required: boolean }>
) => {
  const requiredSkillTitles = requiredSkills
    .filter(skill => skill.is_required)
    .map(skill => skill.title.toLowerCase());
  
  const applicantSkillTitles = skills.map(skill => skill.title.toLowerCase());
  
  const missingSkills = requiredSkillTitles.filter(
    reqSkill => !applicantSkillTitles.some(appSkill => 
      appSkill.includes(reqSkill) || reqSkill.includes(appSkill)
    )
  );

  return missingSkills;
};

export const validateFormData = (formData: {
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
}) => {
  return formData.applicantName && formData.applicantEmail && formData.applicantPhone;
};
