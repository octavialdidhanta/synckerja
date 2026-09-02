
import { useState } from 'react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { useJobApplications, JobApplication } from '../hooks/useJobApplications';
import { format } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/components/ui/use-toast';
import { CandidateQuickViewModal } from './CandidateQuickViewModal';
import {
  isInterviewScheduleComplete,
} from '../lib/recruitmentContactLinks';
import { sendRecruitmentInterviewEmail } from '../lib/sendRecruitmentInterviewEmail';

export const ApplicationsTable = () => {
  const { data: applications = [], error } = useJobApplications();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedApplication, setSelectedApplication] = useState<JobApplication | null>(null);
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ applicationId, newStatus }: { applicationId: string; newStatus: string }) => {
      const { error } = await supabase
        .from('job_applications')
        .update({ status: newStatus })
        .eq('id', applicationId);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      // Invalidate queries to refresh table data
      queryClient.invalidateQueries({ queryKey: ['job-applications'] });
      
      // Update selectedApplication if it's the one being updated
      if (selectedApplication && selectedApplication.id === variables.applicationId) {
        // Optimistically update the selected application
        setSelectedApplication(prev => prev ? { ...prev, status: variables.newStatus } : null);
      }
      
      toast({
        title: 'Success!',
        description: 'Application status updated successfully.',
      });
    },
    onError: (error) => {
      console.error('Error updating status:', error);
      toast({
        title: 'Error!',
        description: 'Failed to update application status.',
        variant: 'destructive'
      });
    }
  });

  const formatSkills = (skills: any) => {
    if (!skills) return 'Not specified';
    
    // Try to parse if it's a JSON string
    let parsedSkills = skills;
    if (typeof skills === 'string') {
      try {
        parsedSkills = JSON.parse(skills);
      } catch (e) {
        // If parsing fails, return the string as is
        return skills;
      }
    }
    
    // Handle array of skills
    if (Array.isArray(parsedSkills)) {
      if (parsedSkills.length === 0) return 'Not specified';
      
      // Format skills with badges/chips
      return parsedSkills.map((skill: any) => {
        const title = skill.title || skill.name || skill;
        const level = skill.skill_level || skill.level;
        return level ? `${title} (${level})` : title;
      }).join(', ');
    }
    
    // Handle object with skills array
    if (parsedSkills && typeof parsedSkills === 'object' && parsedSkills.skills) {
      return formatSkills(parsedSkills.skills);
    }
    
    return 'Not specified';
  };

  const handleStatusChange = (applicationId: string, newStatus: string) => {
    updateStatusMutation.mutate({ applicationId, newStatus });
  };

  const handleQuickView = (application: JobApplication) => {
    setSelectedApplication(application);
    setIsQuickViewOpen(true);
  };

  const handleSendEmail = async (application: JobApplication) => {
    if (!application.applicant_email?.trim()) {
      toast({
        title: 'Error',
        description: 'No email address available for this candidate.',
        variant: 'destructive',
      });
      return;
    }

    if (
      !isInterviewScheduleComplete({
        interviewDate: application.interview_date,
        interviewTime: application.interview_time,
        interviewLocation: application.interview_location,
      })
    ) {
      toast({
        title: 'Interview schedule required',
        description: 'Open Quick View, set interview date/time/location, then send email.',
        variant: 'destructive',
      });
      return;
    }

    const result = await sendRecruitmentInterviewEmail(application.id);
    if (!result.success) {
      toast({
        title: 'Failed to send email',
        description: result.error || 'Could not send interview invitation.',
        variant: 'destructive',
      });
      return;
    }

    handleStatusChange(application.id, 'contacted');
    toast({
      title: 'Email sent',
      description: `Interview invitation sent to ${application.applicant_email}.`,
    });
  };

  const handleCloseQuickView = () => {
    setIsQuickViewOpen(false);
    setSelectedApplication(null);
  };

  const handleStatusUpdate = async (applicationId: string, newStatus: string) => {
    // Update status via mutation (which already invalidates queries)
    handleStatusChange(applicationId, newStatus);
    
    // Also update selectedApplication if it's the one being updated
    if (selectedApplication && selectedApplication.id === applicationId) {
      // Refetch the specific application to get updated data
      const { data: updatedApp, error } = await supabase
        .from('job_applications')
        .select(`
          *,
          job_openings!inner (
            job_title,
            organization_id
          )
        `)
        .eq('id', applicationId)
        .single();
      
      if (!error && updatedApp) {
        setSelectedApplication(updatedApp as JobApplication);
      }
    }
  };

  const handleApplicationUpdate = async () => {
    if (!selectedApplication) return;
    
    // Refetch applications to get updated data including interview_status
    await queryClient.invalidateQueries({ queryKey: ['job-applications'] });
    
    // Refetch directly from database to get the latest data
    const { data: updatedApp, error } = await supabase
      .from('job_applications')
      .select(`
        *,
        job_openings!inner (
          job_title,
          organization_id
        )
      `)
      .eq('id', selectedApplication.id)
      .single();
    
    if (!error && updatedApp) {
      // Update selectedApplication with fresh data
      setSelectedApplication(updatedApp as JobApplication);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'reviewed':
        return 'bg-blue-100 text-blue-800';
      case 'scheduled':
        return 'bg-indigo-100 text-indigo-800';
      case 'contacted':
        return 'bg-green-100 text-green-800';
      case 'confirmed':
        return 'bg-emerald-100 text-emerald-800';
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    const s = (status || 'pending').toLowerCase();
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  if (error) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-8">
        <div className="text-center">
          <p className="text-red-600">Error loading applications: {error.message}</p>
        </div>
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-8">
        <div className="text-center">
          <p className="text-gray-500">No applications found.</p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-x-auto">
        <table className="w-full min-w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Candidate
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Position Applied
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Experience
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Expected Salary
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                Skills
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Applied
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {applications.map((application) => (
              <tr key={application.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {application.applicant_name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {application.applicant_email}
                    </div>
                    <div className="text-sm text-gray-500">
                      {application.applicant_phone || 'No phone'}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {application.job_openings?.job_title || 'Unknown Position'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-green-600">
                    {application.experience_years || 'Not specified'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-green-600">
                    {application.expected_salary || 'Not specified'}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900 max-w-xs">
                    <div className="flex flex-wrap gap-1">
                      {(() => {
                        const skills = application.skills;
                        if (!skills) return <span className="text-gray-400">Not specified</span>;
                        
                        let parsedSkills = skills;
                        if (typeof skills === 'string') {
                          try {
                            parsedSkills = JSON.parse(skills);
                          } catch (e) {
                            return <span>{skills}</span>;
                          }
                        }
                        
                        if (Array.isArray(parsedSkills) && parsedSkills.length > 0) {
                          return parsedSkills.map((skill: any, index: number) => {
                            const title = skill.title || skill.name || skill;
                            const level = skill.skill_level || skill.level;
                            const isRequired = skill.is_required;
                            
                            return (
                              <Badge 
                                key={index}
                                variant={isRequired ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {title}
                                {level && ` (${level})`}
                              </Badge>
                            );
                          });
                        }
                        
                        return <span className="text-gray-400">Not specified</span>;
                      })()}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge className={`text-xs font-medium ${getStatusColor(application.status || 'pending')}`} variant="secondary">
                    {getStatusLabel(application.status || 'pending')}
                  </Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm text-gray-900">
                      {format(new Date(application.created_at), 'dd/MM/yyyy')}
                    </div>
                    <div className="text-sm text-gray-500">
                      {application.recruitment_link_id ? 'via link' : 'direct'}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleQuickView(application)}>
                        Quick View
                      </DropdownMenuItem>
                      <DropdownMenuItem>Download CV</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void handleSendEmail(application)}>
                        Send Email
                      </DropdownMenuItem>
                      <DropdownMenuItem>Send WhatsApp</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

      <CandidateQuickViewModal
        application={selectedApplication}
        isOpen={isQuickViewOpen}
        onClose={handleCloseQuickView}
        onStatusUpdate={handleStatusUpdate}
        onApplicationUpdate={handleApplicationUpdate}
      />
    </>
  );
};
