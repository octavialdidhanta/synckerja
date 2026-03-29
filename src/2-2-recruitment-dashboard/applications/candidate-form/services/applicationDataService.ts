
import { supabase } from '@/shared/lib/supabaseClient';

interface FormData {
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  coverLetter: string;
  experienceYears: string;
  expectedSalary: string;
  birth_date: string;
  gender: string;
  nik: string;
}

export const submitApplicationData = async (
  formData: FormData,
  cvFilePath: string,
  skills: Array<{ title: string; skill_level: string; is_required?: boolean }>,
  jobId: string,
  recruitmentLinkId?: string,
  recruitmentToken?: string,
  organizationId?: string
): Promise<string> => {
  try {
    console.log('📝 Submitting application with form data:', formData);
    console.log('🔗 Using recruitment token:', recruitmentToken);
    
    // Validate recruitment token - it should not be null or undefined for anonymous submissions
    if (!recruitmentToken) {
      console.error('❌ Missing recruitment token for anonymous submission');
      throw new Error('Missing recruitment token. Please access this job through a valid recruitment link.');
    }

    // Create job application first with recruitment token
    const applicationData = {
      job_opening_id: jobId,
      applicant_name: formData.applicantName,
      applicant_email: formData.applicantEmail,
      applicant_phone: formData.applicantPhone || null,
      birth_date: formData.birth_date || null,
      gender: formData.gender || null,
      nik: formData.nik || null,
      cv_file_path: cvFilePath || null,
      cover_letter: formData.coverLetter || null,
      experience_years: formData.experienceYears || null,
      expected_salary: formData.expectedSalary || null,
      skills: JSON.stringify(skills),
      status: 'pending',
      recruitment_link_id: recruitmentLinkId || null,
      recruitment_token: recruitmentToken || null,
      organization_id: organizationId || null
    };

    console.log('📋 Application data to submit:', applicationData);

    const { data: application, error: applicationError } = await supabase
      .from('job_applications')
      .insert(applicationData)
      .select()
      .single();

    if (applicationError) {
      console.error('❌ Error creating job application:', applicationError);
      throw new Error(`Failed to submit job application: ${applicationError.message}`);
    }

    console.log('✅ Job application created successfully:', application);

    // Now create or update candidate profile with the SAME token from job_applications.
    // profile_completed: false so this candidate does NOT appear in /recruitment/interviewees;
    // only candidates who submit at /candidate/profile?token=... (after interview schedule) get profile_completed: true.
    const candidateData = {
      organization_id: organizationId || null,
      full_name: formData.applicantName,
      email: formData.applicantEmail,
      mobile_phone: formData.applicantPhone,
      birth_date: formData.birth_date || null,
      gender: formData.gender || null,
      nik: formData.nik || null,
      cover_letter: formData.coverLetter || null,
      experience_years: formData.experienceYears || null,
      expected_salary: formData.expectedSalary || null,
      employment_status: 'pending',
      status: 'submitted',
      profile_completed: false,
      recruitment_token: recruitmentToken || null // Use the SAME token as job_applications
    };

    console.log('👤 Creating candidate profile with data:', candidateData);

    // Use INSERT with ON CONFLICT to handle duplicates better
    const { data: candidateProfile, error: profileError } = await supabase
      .from('candidate_profiles')
      .insert(candidateData)
      .select()
      .single();

    if (profileError) {
      // If there's a conflict, try to update existing record
      if (profileError.code === '23505') { // unique_violation
        console.log('🔄 Profile exists, updating existing candidate profile');
        const { data: existingProfile, error: updateError } = await supabase
          .from('candidate_profiles')
          .update({
            ...candidateData,
            profile_completed: false,
            updated_at: new Date().toISOString()
          })
          .eq('email', formData.applicantEmail)
          .eq('recruitment_token', recruitmentToken || null)
          .select()
          .single();

        if (updateError) {
          console.error('❌ Error updating candidate profile:', updateError);
          throw new Error(`Failed to update candidate profile: ${updateError.message}`);
        }

        console.log('✅ Candidate profile updated:', existingProfile);
        var finalProfile = existingProfile;
      } else {
        console.error('❌ Error creating candidate profile:', profileError);
        throw new Error(`Failed to create candidate profile: ${profileError.message}`);
      }
    } else {
      console.log('✅ Candidate profile created:', candidateProfile);
      var finalProfile = candidateProfile;
    }

    // Update job application with candidate_profile_id
    const { error: updateApplicationError } = await supabase
      .from('job_applications')
      .update({ candidate_profile_id: finalProfile.id })
      .eq('id', application.id);

    if (updateApplicationError) {
      console.error('❌ Error updating application with profile ID:', updateApplicationError);
    }

    // Return profile link using the recruitment token from job_applications
    const profileLink = `/apply/profile/${finalProfile.id}?token=${recruitmentToken}`;
    return profileLink;

  } catch (error) {
    console.error('💥 Error in submitApplicationData:', error);
    throw error;
  }
};

export const getJobOrganization = async (jobId: string) => {
  try {
    const { data, error } = await supabase
      .from('job_openings')
      .select('organization_id')
      .eq('id', jobId)
      .single();

    if (error) {
      console.error('❌ Error fetching job organization:', error);
      throw new Error(`Failed to get job organization: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('❌ Error in getJobOrganization:', error);
    throw error;
  }
};
