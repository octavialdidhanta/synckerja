
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApplicationSubmission } from '../candidate-form/useApplicationSubmission';
import { CVUploadSection } from '../candidate-form/CVUploadSection';
import { ApplicationSuccess } from '../candidate-form/ApplicationSuccess';
import { JobApplicationSkillsInput } from './JobApplicationSkillsInput';
import { JobApplicationSkill } from '@/2-2-recruitment-dashboard/job-openings/hooks/recruitmentSkillsTypes';
import { ApplicationFormData, ApplicationFormProps } from '../candidate-form/types';
import { useToast } from '@/shared/components/ui/use-toast';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

function formatSalaryDisplay(value: string): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function parseSalaryInput(raw: string): string {
  return raw.replace(/\D/g, '');
}

function isoToDdMmYyyy(iso: string): string {
  if (!iso || iso.length < 10) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function ddMmYyyyToIso(display: string): string {
  const digits = display.replace(/\D/g, '');
  if (digits.length !== 8) return '';
  const d = digits.slice(0, 2);
  const m = digits.slice(2, 4);
  const y = digits.slice(4, 8);
  const day = parseInt(d, 10);
  const month = parseInt(m, 10);
  const year = parseInt(y, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return '';
  return `${y}-${m}-${d}`;
}

function formatBirthDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function ApplicationForm({
  jobId,
  jobTitle,
  companyName,
  onClose,
  recruitmentLinkId,
  recruitmentToken,
  organizationId,
  requiredSkills = []
}: ApplicationFormProps) {
  const { toast } = useToast();
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<ApplicationFormData>({
    // Personal Information
    applicantName: '',
    applicantEmail: '',
    applicantPhone: '',
    birth_date: '',
    gender: '',
    nik: '',
    religion: '',
    marital_status: '',
    nationality: '',
    blood_type: '',
    
    // Address Information
    birth_place: '',
    address: '',
    citizen_address: '',
    postal_code: '',
    
    // Employment Information (read-only)
    department_id: '',
    job_position_id: '',
    job_level_id: '',
    branch_id: '',
    employee_status_id: '',
    join_date: '',
    hire_date: '',
    employment_status: 'pending',
    
    // Application specific
    coverLetter: '',
    experienceYears: '',
    expectedSalary: ''
  });

  const [cvFile, setCvFile] = useState<File | null>(null);
  const [skills, setSkills] = useState<JobApplicationSkill[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [profileLink, setProfileLink] = useState<string>('');
  const [birthDateDisplay, setBirthDateDisplay] = useState<string>('');

  const { submitting, submitApplication } = useApplicationSubmission();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('🎯 Form submitted with data:', {
      formData,
      cvFile: cvFile?.name,
      skills,
      jobId,
      recruitmentLinkId,
      recruitmentToken
    });

    // All fields required on /apply/preview
    const errors: string[] = [];

    if (!formData.applicantName.trim()) {
      errors.push('Full name is required');
    }

    if (!formData.applicantEmail.trim()) {
      errors.push('Email address is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.applicantEmail)) {
      errors.push('Please enter a valid email address');
    }

    if (!formData.applicantPhone.trim()) {
      errors.push('Phone number is required');
    }

    if (!formData.birth_date?.trim()) {
      errors.push('Birth date is required');
    }

    if (!formData.gender?.trim()) {
      errors.push('Gender is required');
    }

    if (!formData.nik.trim()) {
      errors.push('NIK (ID Number) is required');
    } else {
      const nikDigits = formData.nik.replace(/\D/g, '');
      if (nikDigits.length !== 16) {
        errors.push('NIK must be exactly 16 digits');
      }
    }

    if (!cvFile) {
      errors.push('CV/Resume upload is required');
    }

    if (!formData.coverLetter?.trim()) {
      errors.push('Cover letter is required');
    }

    if (!formData.experienceYears?.trim()) {
      errors.push('Years of experience is required');
    }

    if (!formData.expectedSalary?.trim()) {
      errors.push('Expected salary is required');
    }

    // Check required skills
    if (requiredSkills.length > 0) {
      const requiredSkillsToCheck = requiredSkills.filter(skill => skill.is_required);
      const providedSkillTitles = skills.map(skill => skill.title.toLowerCase());
      
      const missingRequiredSkills = requiredSkillsToCheck.filter(requiredSkill => 
        !providedSkillTitles.includes(requiredSkill.title.toLowerCase())
      );

      if (missingRequiredSkills.length > 0) {
        errors.push(`Missing required skills: ${missingRequiredSkills.map(s => s.title).join(', ')}`);
      }
    }

    if (errors.length > 0) {
      toast({
        title: "Validation Error",
        description: errors.join('. '),
        variant: "destructive"
      });
      return;
    }

    await submitApplication({
      formData,
      cvFile,
      skills,
      jobId,
      recruitmentLinkId,
      recruitmentToken,
      organizationId,
      requiredSkills,
      onSuccess: (generatedProfileLink) => {
        console.log('✅ Application successful, profile link:', generatedProfileLink);
        if (generatedProfileLink) {
          setProfileLink(generatedProfileLink);
          setShowSuccess(true);
        }
      }
    });
  };

  const handleCloseSuccess = () => {
    setShowSuccess(false);
    navigate('/apply/thank-you');
    onClose();
  };

  if (showSuccess && profileLink) {
    return (
      <ApplicationSuccess
        profileLink={profileLink}
        applicantName={formData.applicantName}
        onClose={handleCloseSuccess}
      />
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="border-b px-6 py-4 sticky top-0 bg-white z-10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Complete Your Application</h2>
            <p className="text-sm text-gray-600 mt-1">
              {jobTitle} at {companyName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={submitting}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Personal Information */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="applicantName" className="block text-sm font-medium text-gray-700 mb-2">
                Full Name *
              </label>
              <input
                type="text"
                id="applicantName"
                value={formData.applicantName}
                onChange={(e) => setFormData(prev => ({ ...prev, applicantName: e.target.value }))}
                required
                disabled={submitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <label htmlFor="applicantEmail" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                id="applicantEmail"
                value={formData.applicantEmail}
                onChange={(e) => setFormData(prev => ({ ...prev, applicantEmail: e.target.value }))}
                required
                disabled={submitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="Enter your email address"
              />
            </div>

            <div>
              <label htmlFor="applicantPhone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number *
              </label>
              <input
                type="tel"
                id="applicantPhone"
                value={formData.applicantPhone}
                onChange={(e) => setFormData(prev => ({ ...prev, applicantPhone: e.target.value }))}
                required
                disabled={submitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="Enter your phone number"
              />
            </div>

            <div>
              <label htmlFor="birth_date" className="block text-sm font-medium text-gray-700 mb-2">
                Birth Date *
              </label>
              <input
                type="text"
                id="birth_date"
                inputMode="numeric"
                value={birthDateDisplay !== '' ? birthDateDisplay : (formData.birth_date ? isoToDdMmYyyy(formData.birth_date) : '')}
                onChange={(e) => {
                  const formatted = formatBirthDateInput(e.target.value);
                  setBirthDateDisplay(formatted);
                  const iso = ddMmYyyyToIso(formatted);
                  if (iso) setFormData(prev => ({ ...prev, birth_date: iso }));
                  else if (!formatted) setFormData(prev => ({ ...prev, birth_date: '' }));
                }}
                onBlur={() => {
                  const iso = ddMmYyyyToIso(birthDateDisplay);
                  if (iso) setFormData(prev => ({ ...prev, birth_date: iso }));
                  setBirthDateDisplay('');
                }}
                required
                disabled={submitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="dd/mm/yyyy"
              />
            </div>

            <div>
              <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-2">
                Gender *
              </label>
              <select
                id="gender"
                value={formData.gender}
                onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                required
                disabled={submitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            <div>
              <label htmlFor="nik" className="block text-sm font-medium text-gray-700 mb-2">
                NIK (ID Number) *
              </label>
              <input
                type="text"
                inputMode="numeric"
                id="nik"
                value={formData.nik}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 16);
                  setFormData(prev => ({ ...prev, nik: digits }));
                }}
                required
                disabled={submitting}
                maxLength={16}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="16 digit NIK"
              />
              {formData.nik.length > 0 && formData.nik.length !== 16 && (
                <p className="text-sm text-amber-600 mt-1">NIK must be exactly 16 digits</p>
              )}
            </div>
          </div>
        </div>

        <CVUploadSection
          cvFile={cvFile}
          onFileChange={setCvFile}
          disabled={submitting}
        />

        <JobApplicationSkillsInput
          skills={skills}
          onChange={setSkills}
          requiredSkills={requiredSkills}
          disabled={submitting}
        />

        {/* Cover Letter */}
        <div>
          <label htmlFor="coverLetter" className="block text-sm font-medium text-gray-700 mb-2">
            {t('applicationForm.coverLetter.label', 'Cover Letter')} *
          </label>
          <textarea
            id="coverLetter"
            value={formData.coverLetter}
            onChange={(e) => setFormData(prev => ({ ...prev, coverLetter: e.target.value }))}
            rows={4}
            required
            disabled={submitting}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            placeholder={t('applicationForm.coverLetter.placeholder', "Why should we be interested in calling you? Briefly share your motivation and relevance for this role.")}
          />
        </div>

        {/* Experience and Salary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="experienceYears" className="block text-sm font-medium text-gray-700 mb-2">
              Years of Experience *
            </label>
            <input
              type="text"
              id="experienceYears"
              value={formData.experienceYears}
              onChange={(e) => setFormData(prev => ({ ...prev, experienceYears: e.target.value }))}
              required
              disabled={submitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="e.g., 2-3 years"
            />
          </div>

          <div>
            <label htmlFor="expectedSalary" className="block text-sm font-medium text-gray-700 mb-2">
              Expected Salary *
            </label>
            <input
              type="text"
              inputMode="numeric"
              id="expectedSalary"
              value={formatSalaryDisplay(formData.expectedSalary)}
              onChange={(e) => setFormData(prev => ({ ...prev, expectedSalary: parseSalaryInput(e.target.value) }))}
              required
              disabled={submitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="e.g., 8.000.000"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end space-x-4 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Submitting...
              </>
            ) : (
              'Submit Application'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
