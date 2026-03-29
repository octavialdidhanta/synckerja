
import { useState } from 'react';
import { useToast } from '@/shared/components/ui/use-toast';
import { uploadCV } from './services/fileUploadService';
import { submitApplicationData, getJobOrganization } from './services/applicationDataService';
import { incrementCounters } from './services/counterService';
import { ApplicationFormData, SubmissionParams } from './types';

export const useApplicationSubmission = () => {
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const submitApplication = async (params: SubmissionParams) => {
    const {
      formData,
      cvFile,
      skills,
      jobId,
      recruitmentLinkId,
      requiredSkills,
      recruitmentToken,
      organizationId: organizationIdParam,
      onSuccess
    } = params;

    console.log('🚀 Starting application submission with data:', formData);

    // Show initial toast notification
    toast({
      title: "Processing Application",
      description: "Please wait while we submit your application...",
    });

    // Basic validation
    if (!formData.applicantName?.trim()) {
      console.log('❌ Missing applicant name');
      toast({
        title: "Name Required",
        description: "Please enter your full name.",
        variant: "destructive"
      });
      return;
    }

    if (!formData.applicantEmail?.trim()) {
      console.log('❌ Missing applicant email');
      toast({
        title: "Email Required", 
        description: "Please enter your email address.",
        variant: "destructive"
      });
      return;
    }

    if (!formData.applicantPhone?.trim()) {
      console.log('❌ Missing applicant phone');
      toast({
        title: "Phone Required",
        description: "Please enter your phone number.",
        variant: "destructive"
      });
      return;
    }

    if (!formData.birth_date?.trim()) {
      toast({ title: "Birth Date Required", description: "Please enter your birth date.", variant: "destructive" });
      return;
    }
    if (!formData.gender?.trim()) {
      toast({ title: "Gender Required", description: "Please select your gender.", variant: "destructive" });
      return;
    }
    if (!formData.nik?.trim()) {
      toast({ title: "NIK Required", description: "Please enter your NIK (16 digits).", variant: "destructive" });
      return;
    }
    const nikDigits = (formData.nik || '').replace(/\D/g, '');
    if (nikDigits.length !== 16) {
      toast({ title: "Invalid NIK", description: "NIK must be exactly 16 digits.", variant: "destructive" });
      return;
    }
    if (!params.cvFile) {
      toast({ title: "CV Required", description: "Please upload your CV/Resume.", variant: "destructive" });
      return;
    }
    if (!formData.coverLetter?.trim()) {
      toast({ title: "Cover Letter Required", description: "Please fill in the cover letter.", variant: "destructive" });
      return;
    }
    if (!formData.experienceYears?.trim()) {
      toast({ title: "Experience Required", description: "Please enter years of experience.", variant: "destructive" });
      return;
    }
    if (!formData.expectedSalary?.trim()) {
      toast({ title: "Expected Salary Required", description: "Please enter your expected salary.", variant: "destructive" });
      return;
    }

    // Validate required skills if any
    if (requiredSkills && requiredSkills.length > 0) {
      const requiredSkillsToCheck = requiredSkills.filter(skill => skill.is_required);
      const providedSkillTitles = skills.map(skill => skill.title.toLowerCase());
      
      const missingRequiredSkills = requiredSkillsToCheck.filter(requiredSkill => 
        !providedSkillTitles.includes(requiredSkill.title.toLowerCase())
      );

      if (missingRequiredSkills.length > 0) {
        console.log('❌ Missing required skills:', missingRequiredSkills);
        toast({
          title: "Missing Required Skills",
          description: `Please add the following required skills: ${missingRequiredSkills.map(s => s.title).join(', ')}`,
          variant: "destructive"
        });
        return;
      }
    }

    setSubmitting(true);

    try {
      let organizationId: string;
      if (organizationIdParam) {
        organizationId = organizationIdParam;
        console.log('✅ Using organization_id from link:', organizationId);
      } else {
        console.log('🔍 Getting organization for job:', jobId);
        toast({
          title: "Getting Job Information",
          description: "Retrieving job details...",
        });
        const jobOrgData = await getJobOrganization(jobId);
        organizationId = jobOrgData.organization_id;
        console.log('✅ Using organization_id:', organizationId);
      }

      // Upload CV if provided
      let cvFilePath = '';
      if (cvFile) {
        console.log('📄 Uploading CV file...');
        toast({
          title: "Uploading CV",
          description: "Uploading your CV file...",
        });
        cvFilePath = await uploadCV(cvFile, formData.applicantName);
        console.log('✅ CV uploaded to:', cvFilePath);
      }

      // Convert skills to the expected format for submitApplicationData
      const skillsForSubmission = skills.map(skill => ({
        title: skill.title,
        skill_level: skill.level || 'intermediate',
        is_required: false
      }));

      console.log('💾 Submitting application data with skills:', skillsForSubmission);
      
      toast({
        title: "Finalizing Application",
        description: "Saving your application data...",
      });

      // Convert ApplicationFormData to the format expected by submitApplicationData
      const submissionFormData = {
        applicantName: formData.applicantName,
        applicantEmail: formData.applicantEmail,
        applicantPhone: formData.applicantPhone,
        coverLetter: formData.coverLetter,
        experienceYears: formData.experienceYears,
        expectedSalary: formData.expectedSalary,
        birth_date: formData.birth_date,
        gender: formData.gender,
        nik: formData.nik
      };

      const profileLink = await submitApplicationData(
        submissionFormData,
        cvFilePath,
        skillsForSubmission,
        jobId,
        recruitmentLinkId,
        recruitmentToken,
        organizationId
      );

      // Increment counters
      console.log('📈 Incrementing counters...');
      try {
        await incrementCounters(jobId, recruitmentLinkId);
        console.log('✅ Counters updated successfully');
      } catch (counterError) {
        console.warn('⚠️ Warning: Could not update counters:', counterError);
        // Don't fail the whole submission for counter errors
      }

      console.log('✅ Application submitted successfully!');
      
      toast({
        title: "Application Submitted Successfully!",
        description: "Thank you for your application. We will review it and get back to you soon.",
      });

      onSuccess(profileLink);

    } catch (error) {
      console.error('💥 Error submitting application:', error);
      
      // Show detailed error message
      let errorMessage = "An unexpected error occurred. Please try again.";
      
      if (error instanceof Error) {
        // Handle specific error cases with improved messaging
        if (error.message.includes('Missing recruitment token')) {
          errorMessage = "Invalid recruitment link. Please access this job through a valid job posting link.";
        } else if (error.message.includes('duplicate key')) {
          errorMessage = "You have already submitted an application for this position.";
        } else if (error.message.includes('foreign key')) {
          errorMessage = "Invalid job posting or recruitment link.";
        } else if (error.message.includes('network')) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (error.message.includes('violates row-level security')) {
          errorMessage = "Access denied. Please ensure you're using a valid recruitment link.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Submission Failed",
        description: errorMessage,
        variant: "destructive"
      });

      // Log additional error details for debugging
      console.error('Detailed error info:', {
        error,
        formData,
        jobId,
        recruitmentLinkId,
        skills
      });
    } finally {
      setSubmitting(false);
    }
  };

  return {
    submitting,
    submitApplication
  };
};
