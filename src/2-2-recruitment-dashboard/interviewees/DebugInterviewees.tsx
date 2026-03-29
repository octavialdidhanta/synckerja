import { useState, useEffect } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';

export const DebugInterviewees = () => {
  const [debugData, setDebugData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runDebug = async () => {
    setLoading(true);
    try {
      console.log('🔍 Running debug check...');

      // 1. Check candidate_profiles
      const { data: allProfiles, error: profilesError } = await supabase
        .from('candidate_profiles')
        .select('*')
        .limit(10);

      // 2. Check completed profiles
      const { data: completedProfiles, error: completedError } = await supabase
        .from('candidate_profiles')
        .select('*')
        .eq('profile_completed', true)
        .not('recruitment_token', 'is', null);

      // 3. Check job_applications
      const { data: allApplications, error: applicationsError } = await supabase
        .from('job_applications')
        .select('*')
        .limit(10);

      // 4. Check job_openings
      const { data: jobOpenings, error: openingsError } = await supabase
        .from('job_openings')
        .select('*')
        .limit(5);

      // 5. Check matching applications
      let matchingApplications = [];
      if (completedProfiles && completedProfiles.length > 0) {
        const recruitmentTokens = completedProfiles.map(p => p.recruitment_token).filter(Boolean);
        const { data: matching, error: matchingError } = await supabase
          .from('job_applications')
          .select('*')
          .in('recruitment_token', recruitmentTokens);
        
        if (!matchingError) {
          matchingApplications = matching || [];
        }
      }

      const debugResult = {
        allProfiles: allProfiles || [],
        completedProfiles: completedProfiles || [],
        allApplications: allApplications || [],
        jobOpenings: jobOpenings || [],
        matchingApplications: matchingApplications,
        errors: {
          profilesError,
          completedError,
          applicationsError,
          openingsError
        }
      };

      setDebugData(debugResult);
      console.log('✅ Debug data:', debugResult);

    } catch (error) {
      console.error('💥 Debug error:', error);
    } finally {
      setLoading(false);
    }
  };

  const addSampleData = async () => {
    setLoading(true);
    try {
      console.log('🚀 Adding sample data...');

      // Create a job opening first
      const { data: jobOpening, error: jobError } = await supabase
        .from('job_openings')
        .insert({
          job_title: 'Frontend Developer',
          job_description: 'We are looking for a skilled Frontend Developer.',
          requirements: 'React, TypeScript, CSS',
          location: 'Jakarta',
          employment_type: 'full-time',
          salary_range: '8-12 juta',
          status: 'active'
        })
        .select()
        .single();

      if (jobError) {
        console.error('❌ Error creating job opening:', jobError);
        return;
      }

      // Create candidate profiles
      const candidateProfiles = [
        {
          full_name: 'John Doe',
          email: 'john.doe@example.com',
          mobile_phone: '+6281234567890',
          birth_date: '1990-01-15',
          gender: 'male',
          nik: '1234567890123456',
          profile_completed: true,
          recruitment_token: 'cand_' + Math.random().toString(36).substr(2, 8),
          address: 'Jakarta Selatan',
          nationality: 'Indonesian',
          religion: 'Islam',
          marital_status: 'single'
        },
        {
          full_name: 'Jane Smith',
          email: 'jane.smith@example.com',
          mobile_phone: '+6281234567891',
          birth_date: '1992-05-20',
          gender: 'female',
          nik: '1234567890123457',
          profile_completed: true,
          recruitment_token: 'cand_' + Math.random().toString(36).substr(2, 8),
          address: 'Jakarta Utara',
          nationality: 'Indonesian',
          religion: 'Kristen',
          marital_status: 'married'
        }
      ];

      const { data: profiles, error: profilesError } = await supabase
        .from('candidate_profiles')
        .insert(candidateProfiles)
        .select();

      if (profilesError) {
        console.error('❌ Error creating profiles:', profilesError);
        return;
      }

      // Create job applications
      const jobApplications = profiles.map((profile, index) => ({
        job_opening_id: jobOpening.id,
        applicant_name: profile.full_name,
        applicant_email: profile.email,
        applicant_phone: profile.mobile_phone,
        recruitment_token: profile.recruitment_token,
        candidate_profile_id: profile.id,
        status: 'pending',
        interview_status: index === 0 ? 'scheduled' : 'not_scheduled',
        interview_date: index === 0 ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null,
        interview_time: index === 0 ? '10:00' : null,
        interview_location: index === 0 ? 'Office Jakarta' : null,
        interviewer_name: index === 0 ? 'HR Manager' : null,
        cover_letter: `I am interested in the ${jobOpening.job_title} position.`,
        experience_years: '3-5 years',
        expected_salary: '10 juta',
        skills: ['React', 'TypeScript', 'CSS']
      }));

      const { data: applications, error: applicationsError } = await supabase
        .from('job_applications')
        .insert(jobApplications)
        .select();

      if (applicationsError) {
        console.error('❌ Error creating applications:', applicationsError);
        return;
      }

      console.log('✅ Sample data created successfully!');
      alert('Sample data created! Refresh the page to see the data.');

    } catch (error) {
      console.error('💥 Error adding sample data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Debug Interviewees Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={runDebug} disabled={loading}>
              {loading ? 'Checking...' : 'Check Data'}
            </Button>
            <Button onClick={addSampleData} disabled={loading} variant="outline">
              {loading ? 'Adding...' : 'Add Sample Data'}
            </Button>
          </div>

          {debugData && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">Debug Results:</h3>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <Badge variant="outline">
                      All Profiles: {debugData.allProfiles.length}
                    </Badge>
                  </div>
                  <div>
                    <Badge variant="outline">
                      Completed Profiles: {debugData.completedProfiles.length}
                    </Badge>
                  </div>
                  <div>
                    <Badge variant="outline">
                      All Applications: {debugData.allApplications.length}
                    </Badge>
                  </div>
                  <div>
                    <Badge variant="outline">
                      Job Openings: {debugData.jobOpenings.length}
                    </Badge>
                  </div>
                  <div>
                    <Badge variant="outline">
                      Matching Applications: {debugData.matchingApplications.length}
                    </Badge>
                  </div>
                </div>
              </div>

              {debugData.completedProfiles.length > 0 && (
                <div>
                  <h4 className="font-medium">Completed Profiles:</h4>
                  <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
                    {JSON.stringify(debugData.completedProfiles, null, 2)}
                  </pre>
                </div>
              )}

              {debugData.matchingApplications.length > 0 && (
                <div>
                  <h4 className="font-medium">Matching Applications:</h4>
                  <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
                    {JSON.stringify(debugData.matchingApplications, null, 2)}
                  </pre>
                </div>
              )}

              {Object.values(debugData.errors).some(error => error) && (
                <div>
                  <h4 className="font-medium text-red-600">Errors:</h4>
                  <pre className="text-xs bg-red-100 p-2 rounded overflow-auto">
                    {JSON.stringify(debugData.errors, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};


