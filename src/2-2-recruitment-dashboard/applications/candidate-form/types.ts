
export interface ApplicationFormData {
  // Personal Information
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  birth_date: string;
  gender: string;
  nik: string;
  religion: string;
  marital_status: string;
  nationality: string;
  blood_type: string;
  
  // Address Information
  birth_place: string;
  address: string;
  citizen_address: string;
  postal_code: string;
  
  // Employment Information (read-only for candidates)
  department_id: string;
  job_position_id: string;
  job_level_id: string;
  branch_id: string;
  employee_status_id: string;
  join_date: string;
  hire_date: string;
  employment_status: string;
  
  // Application specific
  coverLetter: string;
  experienceYears: string;
  expectedSalary: string;
}

export interface ApplicationFormProps {
  jobId: string;
  jobTitle: string;
  companyName: string;
  onClose: () => void;
  recruitmentLinkId?: string;
  recruitmentToken?: string;
  organizationId?: string;
  requiredSkills?: Array<{ title: string; skill_level: string; is_required: boolean }>;
}

export interface SubmissionParams {
  formData: ApplicationFormData;
  cvFile: File | null;
  skills: Array<{ title: string; level: string; experience_years?: number }>;
  jobId: string;
  recruitmentLinkId?: string;
  recruitmentToken?: string;
  organizationId?: string;
  requiredSkills: Array<{ title: string; skill_level: string; is_required: boolean }>;
  onSuccess: (profileLink: string) => void;
}
