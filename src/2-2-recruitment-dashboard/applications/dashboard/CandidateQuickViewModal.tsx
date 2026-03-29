import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Separator } from '@/shared/components/ui/separator';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
// import { DocumentPreview } from '@/components/DocumentPreview';
// import { ScheduleInterviewForm } from '@/components/ScheduleInterviewForm';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Briefcase, 
  DollarSign, 
  FileText, 
  Calendar,
  Star,
  Award,
  Clock,
  X,
  Send,
  Download,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Maximize2,
  Minus,
  Plus
} from 'lucide-react';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { formatToRupiah } from '@/utils/formatCurrency';
import { format, differenceInYears } from 'date-fns';

interface JobApplication {
  id: string;
  applicant_name: string;
  applicant_email: string;
  applicant_phone: string;
  birth_date?: string;
  gender?: string;
  nik?: string;
  cv_file_path: string | null;
  cover_letter: string | null;
  experience_years: string | null;
  expected_salary: string | null;
  skills: any;
  status: string;
  created_at: string;
  recruitment_token: string | null; // This will be synced from candidate_profiles
  job_opening_id: string;
  candidate_profile_id?: string;
  interview_date?: string;
  interview_time?: string;
  interview_location?: string;
  interviewer_name?: string;
  interviewer_email?: string;
  interview_notes?: string;
  interview_status?: string;
  job_openings?: {
    job_title: string;
    salary_min?: number;
    salary_max?: number;
  };
}

interface CandidateQuickViewModalProps {
  application: JobApplication | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdate: (applicationId: string, newStatus: string) => void;
  onApplicationUpdate?: () => void; // Callback to refresh application data
}

export const CandidateQuickViewModal = ({ 
  application, 
  isOpen, 
  onClose, 
  onStatusUpdate,
  onApplicationUpdate
}: CandidateQuickViewModalProps) => {
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [candidateScore, setCandidateScore] = useState<number>(0);
  const [cvPreviewUrl, setCvPreviewUrl] = useState<string | null>(null);
  const [isLoadingCv, setIsLoadingCv] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [companyName, setCompanyName] = useState<string>('');
  const [interviewDate, setInterviewDate] = useState<string>('');
  const [interviewTime, setInterviewTime] = useState<string>('');
  const [interviewLocation, setInterviewLocation] = useState<string>('');
  const [interviewerName, setInterviewerName] = useState<string>('');
  const [interviewerEmail, setInterviewerEmail] = useState<string>('');
  const [interviewNotes, setInterviewNotes] = useState<string>('');
  const [savingInterview, setSavingInterview] = useState(false);
  const hasAutoReviewedRef = useRef(false);
  const { toast } = useToast();
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const calculateAge = (birthDate: string): number => {
    if (!birthDate) return 0;
    return differenceInYears(new Date(), new Date(birthDate));
  };

  const calculateCandidateScore = async (candidateProfileId: string): Promise<number> => {
    try {
      let score = 0;
      
      const { data: reviews, error: reviewsError } = await supabase
        .from('candidate_reviews')
        .select('*')
        .eq('candidate_profile_id', candidateProfileId);

      if (reviewsError) {
        console.warn('Could not fetch reviews:', reviewsError);
        return 0;
      }

      if (reviews && reviews.length > 0) {
        const totalRating = reviews.reduce((sum, review) => sum + ((review as any).rating || 0), 0);
        const averageRating = totalRating / reviews.length;
        score = (averageRating / 5) * 100;
      } else {
        const candidate = application;
        if (!candidate) return 0;

        if (candidate.experience_years) {
          const years = parseInt(candidate.experience_years);
          if (years >= 5) score += 30;
          else if (years >= 3) score += 25;
          else if (years >= 1) score += 20;
          else score += 10;
        }
        
        const profileFields = [
          candidate.applicant_phone,
          candidate.birth_date,
          candidate.gender,
          candidate.nik,
          candidate.cover_letter
        ];
        const completedFields = profileFields.filter(field => field && field.toString().trim() !== '').length;
        score += (completedFields / profileFields.length) * 25;
        
        if (candidate.cover_letter) {
          const coverLetterLength = candidate.cover_letter.length;
          if (coverLetterLength >= 300) score += 15;
          else if (coverLetterLength >= 150) score += 12;
          else if (coverLetterLength >= 50) score += 8;
          else score += 5;
        }
        
        const applicationDate = new Date(candidate.created_at);
        const now = new Date();
        const daysSinceApplication = Math.floor((now.getTime() - applicationDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysSinceApplication <= 3) score += 10;
        else if (daysSinceApplication <= 7) score += 8;
        else if (daysSinceApplication <= 14) score += 6;
        else score += 4;

        if (candidate.cv_file_path) score += 20;
      }
      
      return Math.round(score);
    } catch (error) {
      console.error('Error calculating candidate score:', error);
      return 0;
    }
  };

  // Reset auto-reviewed ref when modal closes so next open can trigger again
  React.useEffect(() => {
    if (!isOpen) hasAutoReviewedRef.current = false;
  }, [isOpen]);

  React.useEffect(() => {
    if (isOpen && application) {
      if (application.candidate_profile_id) {
        loadCandidateDocuments();
        calculateScore();
      }
      loadCvPreview();
      loadCompanyName();
      // Auto Pending -> Reviewed when Quick View opens (once per open)
      if (application.status === 'pending' && !hasAutoReviewedRef.current) {
        hasAutoReviewedRef.current = true;
        (async () => {
          try {
            const { error } = await supabase
              .from('job_applications')
              .update({ status: 'reviewed' })
              .eq('id', application.id);
            if (error) throw error;
            await queryClient.invalidateQueries({ queryKey: ['job-applications'] });
            onStatusUpdate(application.id, 'reviewed');
            if (onApplicationUpdate) await onApplicationUpdate();
          } catch (e) {
            console.error('Auto-update status to reviewed failed:', e);
            hasAutoReviewedRef.current = false;
          }
        })();
      }
      // Initialize interview form fields - only set if data exists and is valid
      // Check if interview_date exists and is a valid date string
      const hasValidDate = application.interview_date && 
        typeof application.interview_date === 'string' && 
        application.interview_date.trim() !== '' &&
        !isNaN(new Date(application.interview_date).getTime());
      
      setInterviewDate(hasValidDate ? application.interview_date : '');
      setInterviewTime(
        application.interview_time && application.interview_time.trim() !== '' 
          ? application.interview_time 
          : ''
      );
      setInterviewLocation(
        application.interview_location && application.interview_location.trim() !== '' 
          ? application.interview_location 
          : ''
      );
      setInterviewerName(
        application.interviewer_name && application.interviewer_name.trim() !== '' 
          ? application.interviewer_name 
          : ''
      );
      setInterviewerEmail(
        application.interviewer_email && application.interviewer_email.trim() !== '' 
          ? application.interviewer_email 
          : ''
      );
      setInterviewNotes(
        application.interview_notes && application.interview_notes.trim() !== '' 
          ? application.interview_notes 
          : ''
      );
    } else if (isOpen && !application) {
      // Reset all fields when modal opens without application
      setInterviewDate('');
      setInterviewTime('');
      setInterviewLocation('');
      setInterviewerName('');
      setInterviewerEmail('');
      setInterviewNotes('');
    }
    return () => {
      // Cleanup preview URL when modal closes
      if (cvPreviewUrl) {
        URL.revokeObjectURL(cvPreviewUrl);
      }
    };
  }, [isOpen, application]);

  const loadCompanyName = async () => {
    if (!organizationId) return;
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('company_name')
        .eq('id', organizationId)
        .maybeSingle();
      
      if (!error && data) {
        const orgData = data as { company_name?: string };
        setCompanyName(orgData?.company_name || '');
      }
    } catch (error) {
      console.error('Error loading company name:', error);
    }
  };

  const loadCvPreview = async () => {
    if (!application?.cv_file_path) {
      setCvPreviewUrl(null);
      return;
    }

    setIsLoadingCv(true);
    try {
      // CV files are stored in recruitment-files bucket
      const { data, error } = await supabase.storage
        .from('recruitment-files')
        .createSignedUrl(application.cv_file_path, 3600); // 1 hour expiry

      if (error) {
        console.error('Error loading CV preview:', error);
        toast({
          title: 'Error',
          description: 'Failed to load CV preview. Please check if the file exists.',
          variant: 'destructive'
        });
        setCvPreviewUrl(null);
        return;
      }

      setCvPreviewUrl(data.signedUrl);
    } catch (error: any) {
      console.error('Error generating CV preview URL:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate CV preview URL',
        variant: 'destructive'
      });
      setCvPreviewUrl(null);
    } finally {
      setIsLoadingCv(false);
    }
  };

  const loadCandidateDocuments = async () => {
    if (!application?.candidate_profile_id) return;

    try {
      const { data, error } = await supabase
        .from('candidate_documents')
        .select('*')
        .eq('candidate_profile_id', application.candidate_profile_id);

      if (error) {
        console.error('Error loading documents:', error);
        return;
      }

      setDocuments(data || []);
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const calculateScore = async () => {
    if (!application?.candidate_profile_id) return;

    const score = await calculateCandidateScore(application.candidate_profile_id);
    setCandidateScore(score);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!application) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('job_applications')
        .update({ status: newStatus })
        .eq('id', application.id);

      if (error) throw error;

      // Invalidate queries to refresh table data
      await queryClient.invalidateQueries({ queryKey: ['job-applications'] });
      
      // Update local application state
      if (onApplicationUpdate) {
        await onApplicationUpdate();
      }
      
      // Notify parent component to update status
      onStatusUpdate(application.id, newStatus);
      
      toast({
        title: "Success",
        description: "Application status updated successfully.",
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Error",
        description: "Failed to update application status.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRejectCandidate = async () => {
    if (!application) return;
    
    await handleStatusChange('rejected');
    toast({
      title: "Candidate Rejected",
      description: "The candidate has been rejected.",
      variant: "destructive",
    });
  };

  const handleUpdateInterviewSchedule = async () => {
    if (!application) return;

    setSavingInterview(true);
    try {
      // Determine interview status based on date
      // Auto-update: 'Scheduled' when date is set
      // 'Completed' status is set automatically by database trigger when candidate submits profile
      let newInterviewStatus = application.interview_status || null;
      
      if (interviewDate) {
        // Only set to 'scheduled' if not already 'completed'
        // Once 'completed', status should not be changed back to 'scheduled'
        if (application.interview_status !== 'completed') {
          newInterviewStatus = 'scheduled';
        } else {
          // Keep 'completed' status even if date is set
          newInterviewStatus = 'completed';
        }
      } else if (!interviewDate) {
        // If date is removed, only clear status if not 'completed'
        // 'Completed' status should persist even if date is removed
        if (application.interview_status !== 'completed') {
          newInterviewStatus = null;
        } else {
          // Keep 'completed' status
          newInterviewStatus = 'completed';
        }
      }

      // When saving schedule with date set, set application status to 'scheduled'
      const newStatus = interviewDate ? 'scheduled' : application.status || 'pending';

      const { error } = await supabase
        .from('job_applications')
        .update({
          interview_date: interviewDate || null,
          interview_time: interviewTime || null,
          interview_location: interviewLocation || null,
          interviewer_name: interviewerName || null,
          interviewer_email: interviewerEmail || null,
          interview_notes: interviewNotes || null,
          interview_status: newInterviewStatus,
          status: newStatus
        })
        .eq('id', application.id);

      if (error) throw error;

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['job-applications'] });
      
      toast({
        title: "Success",
        description: "Interview schedule updated successfully.",
      });

      // Refresh application data so table and modal show Scheduled
      onStatusUpdate(application.id, newStatus);
      
      // Call callback to refresh application in parent component
      // This will update the selectedApplication with fresh data
      if (onApplicationUpdate) {
        await onApplicationUpdate();
      }
    } catch (error: any) {
      console.error('Error updating interview schedule:', error);
      toast({
        title: "Error",
        description: "Failed to update interview schedule.",
        variant: "destructive",
      });
    } finally {
      setSavingInterview(false);
    }
  };

  const handleSendEmail = () => {
    if (!application?.applicant_email) {
      toast({
        title: "Error",
        description: "No email address available for this candidate.",
        variant: "destructive",
      });
      return;
    }

    const positionTitle = application.job_openings?.job_title || 'the position';
    const profileLink = application.recruitment_token ? 
      `${window.location.origin}/candidate/profile?token=${application.recruitment_token}` : 
      '';

    // Format date
    let formattedDate = '';
    if (application.interview_date) {
      formattedDate = format(new Date(application.interview_date), 'EEEE, MMMM dd, yyyy');
    }

    // Format time
    const formattedTime = application.interview_time || '';

    // Build email body with exact format requested
    let emailBody = `INTERVIEW INVITATION
===================

Dear ${application.applicant_name}

Thank you for your interest in the ${positionTitle} position with ${companyName || 'our organization'}.

We have reviewed your application and would like to invite you for an interview to discuss your qualifications further.`;

    // Add interview details if available
    if (formattedDate || formattedTime || application.interview_location || application.interviewer_name) {
      emailBody += `

Interview Details:`;

      if (formattedDate) {
        emailBody += `

  Date: ${formattedDate}`;
      }

      if (formattedTime) {
        emailBody += `
  Time: ${formattedTime}`;
      }

      if (application.interview_location) {
        emailBody += `
  Location: ${application.interview_location}`;
      }

      if (application.interviewer_name) {
        emailBody += `
  Interviewer: ${application.interviewer_name}`;
      }
    }

    if (application.interview_notes?.trim()) {
      emailBody += `

Additional Notes:
${application.interview_notes.trim()}`;
    }

    // Add profile completion link if available
    if (profileLink) {
      emailBody += `

Profile Completion Required:

${profileLink}`;
    }

    emailBody += `



Best regards,
HR Recruitment Team
================== 
Please reply to confirm your availability`;

    const subject = `Interview Invitation - ${positionTitle}`;
    const mailtoUrl = `mailto:${application.applicant_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
    
    window.open(mailtoUrl, '_blank');
    handleStatusChange('contacted');
  };

  const handleSendWhatsApp = () => {
    if (!application?.applicant_phone) {
      toast({
        title: "Error",
        description: "No phone number available for this candidate.",
        variant: "destructive",
      });
      return;
    }

    // Format phone number to +62
    let phoneNumber = application.applicant_phone.replace(/[^0-9]/g, '');
    if (phoneNumber.startsWith('0')) {
      phoneNumber = '62' + phoneNumber.substring(1);
    } else if (!phoneNumber.startsWith('62')) {
      phoneNumber = '62' + phoneNumber;
    }
    
    const positionTitle = application.job_openings?.job_title || 'the position';
    
    // Use the correct profile link with /candidate/profile
    const profileLink = application.recruitment_token ? 
      `${window.location.origin}/candidate/profile?token=${application.recruitment_token}` : 
      '';
    
    let message = `*INTERVIEW INVITATION*
━━━━━━━━━━━━━━━━━━━━━━━━━

${application.applicant_name}

Thank you for your interest in the *${positionTitle}* position with our organization.

We have reviewed your application and would like to invite you for an interview to discuss your qualifications further.`;

    // Add profile completion section if link exists
    if (profileLink) {
      message += `

*Profile Completion Required:*
Please complete your profile data through the following link before the interview:
${profileLink}`;
    }

    // Add interview details if scheduled
    if (application.interview_date || application.interview_time || application.interview_location || application.interviewer_name) {
      message += `

*Interview Details:*`;
      
      if (application.interview_date) {
        const formattedDate = format(new Date(application.interview_date), 'EEEE, MMMM dd, yyyy');
        message += `
📅 Date: ${formattedDate}`;
      }
      
      if (application.interview_time) {
        message += `
🕐 Time: ${application.interview_time}`;
      }
      
      if (application.interview_location) {
        message += `
📍 Location: ${application.interview_location}`;
      }
      
      if (application.interviewer_name) {
        message += `
👤 Interviewer: ${application.interviewer_name}`;
      }
    }

    if (application.interview_notes?.trim()) {
      message += `

*Additional Notes:*
${application.interview_notes.trim()}`;
    }

    message += `

Best regards,
HR Recruitment Team

━━━━━━━━━━━━━━━━━━━━━━━━━
Please reply to confirm your availability`;
    
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    
    window.open(whatsappUrl, '_blank');
    handleStatusChange('contacted');

    console.log('🔍 Using recruitment token:', application.recruitment_token);
    console.log('🔗 Profile link used:', profileLink);
  };

  const parseSkills = (skills: any) => {
    try {
      if (typeof skills === 'string') {
        return JSON.parse(skills);
      }
      return Array.isArray(skills) ? skills : [];
    } catch {
      return [];
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 60) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (score >= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  if (!application) return null;

  const skills = parseSkills(application.skills);
  const age = application.birth_date ? calculateAge(application.birth_date) : null;
  const positionApplied = application.job_openings?.job_title || 'Position Applied';
  const scheduleSaved = Boolean(
    application.interview_date?.trim() &&
    application.interview_time?.trim() &&
    application.interview_location?.trim()
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <User className="h-6 w-6 text-blue-600" />
              <div>
                <div className="text-xl font-bold">{application.applicant_name}</div>
                {age && <div className="text-sm text-gray-500 font-normal">{age} years old</div>}
              </div>
            </div>
          </DialogTitle>
          
          <div className="flex items-center justify-between pt-2">
            <div className={`flex items-center px-3 py-1 rounded-full border text-sm font-medium ${getScoreColor(candidateScore)}`}>
              <Star className="h-4 w-4 mr-1" />
              Score: {candidateScore}/100
            </div>
            
            <div className="flex space-x-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRejectCandidate}
                disabled={loading}
              >
                <X className="h-4 w-4 mr-1" />
                Reject Kandidat
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSendEmail}
                disabled={loading || !scheduleSaved}
                className="text-blue-600 border-blue-600 hover:bg-blue-50"
              >
                <Mail className="h-4 w-4 mr-1" />
                Send Email
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSendWhatsApp}
                disabled={loading || !scheduleSaved}
                className="text-green-600 border-green-600 hover:bg-green-50"
              >
                <Send className="h-4 w-4 mr-1" />
                Send WhatsApp
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Main Content - Left and Right Layout - Point 3: Make document preview wider */}
        <div className="grid grid-cols-5 gap-6 h-[80vh]">
          {/* Left Side - Information and Forms - Reduced from 50% to 40% */}
          <div className="col-span-2 space-y-4 overflow-y-auto pr-2">
            {/* Personal Information */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center space-x-2 text-lg">
                  <User className="h-5 w-5" />
                  <span>Personal Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center text-sm text-gray-500 mb-1">
                      <Mail className="h-4 w-4 mr-2" />
                      Email
                    </div>
                    <p className="font-medium text-sm">{application.applicant_email}</p>
                  </div>
                  <div>
                    <div className="flex items-center text-sm text-gray-500 mb-1">
                      <Phone className="h-4 w-4 mr-2" />
                      Phone
                    </div>
                    <p className="font-medium text-sm">{application.applicant_phone}</p>
                  </div>
                  {application.gender && (
                    <div>
                      <div className="flex items-center text-sm text-gray-500 mb-1">
                        <User className="h-4 w-4 mr-2" />
                        Gender
                      </div>
                      <p className="font-medium text-sm capitalize">{application.gender}</p>
                    </div>
                  )}
                  {age && (
                    <div>
                      <div className="flex items-center text-sm text-gray-500 mb-1">
                        <Calendar className="h-4 w-4 mr-2" />
                        Age
                      </div>
                      <p className="font-medium text-sm">{age} years old</p>
                    </div>
                  )}
                  {application.nik && (
                    <div>
                      <div className="flex items-center text-sm text-gray-500 mb-1">
                        <FileText className="h-4 w-4 mr-2" />
                        NIK
                      </div>
                      <p className="font-medium text-sm">{application.nik}</p>
                    </div>
                  )}
                </div>
                
                {/* Profile Completion Link Section - now using synchronized token */}
                {application.recruitment_token && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center text-sm text-blue-700 mb-2">
                      <FileText className="h-4 w-4 mr-2" />
                      Profile Completion Link (Synchronized)
                    </div>
                    <div className="text-sm text-blue-600 mb-2">
                      Please complete your profile data through the following link before the interview:
                    </div>
                    <div className="bg-white p-2 rounded border text-xs font-mono break-all">
                      {`${window.location.origin}/candidate/profile?token=${application.recruitment_token}`}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Application Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center space-x-2 text-lg">
                  <Briefcase className="h-5 w-5" />
                  <span>Application Details</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex items-center text-sm text-gray-500 mb-1">
                    <Briefcase className="h-4 w-4 mr-2" />
                    Position Applied
                  </div>
                  <p className="font-medium text-sm">{positionApplied}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center text-sm text-gray-500 mb-1">
                      <Clock className="h-4 w-4 mr-2" />
                      Experience
                    </div>
                    <p className="font-medium text-sm">{application.experience_years || 'Not specified'} years</p>
                  </div>
                  <div>
                    <div className="flex items-center text-sm text-gray-500 mb-1">
                      <DollarSign className="h-4 w-4 mr-2" />
                      Expected Salary
                    </div>
                    <p className="font-medium text-green-600 text-sm">
                      {formatToRupiah(application.expected_salary)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center text-sm text-gray-500 mb-1">
                      <Calendar className="h-4 w-4 mr-2" />
                      Applied Date
                    </div>
                    <p className="font-medium text-sm">{format(new Date(application.created_at), 'MMM dd, yyyy')}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500 mb-1 block">Status</label>
                    <Badge variant="secondary">
                      {((application.status || 'pending').replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase()))}
                    </Badge>
                    <p className="text-xs text-gray-500 mt-1">Updated by actions in this modal</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Skills & Competencies */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center space-x-2 text-lg">
                  <Award className="h-5 w-5" />
                  <span>Skills & Competencies</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {skills.map((skill: any, index: number) => (
                    <Badge key={index} variant="secondary" className="px-2 py-1 text-xs">
                      <span className="font-medium">{skill.title}</span>
                      {skill.skill_level && (
                        <span className="ml-2 text-xs opacity-75">({skill.skill_level})</span>
                      )}
                      {application.experience_years && (
                        <span className="ml-2 text-xs text-blue-600">• {application.experience_years}y exp</span>
                      )}
                    </Badge>
                  ))}
                  {skills.length === 0 && (
                    <p className="text-gray-500 text-sm">No skills specified</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Cover Letter */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center space-x-2 text-lg">
                  <FileText className="h-5 w-5" />
                  <span>Cover Letter</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {application.cover_letter ? (
                  <div className="bg-gray-50 p-3 rounded-lg max-h-24 overflow-y-auto">
                    <p className="text-gray-700 whitespace-pre-wrap text-sm">{application.cover_letter}</p>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No cover letter provided</p>
                )}
              </CardContent>
            </Card>

            {/* Schedule Interview */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center space-x-2 text-lg">
                  <Calendar className="h-5 w-5" />
                  <span>Schedule Interview</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Interview Date */}
                <div className="space-y-2">
                  <Label htmlFor="interview-date" className="flex items-center text-sm font-medium">
                    <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                    Interview Date
                  </Label>
                  <Input
                    id="interview-date"
                    type="date"
                    value={interviewDate && interviewDate.trim() !== '' && !isNaN(new Date(interviewDate).getTime()) 
                      ? new Date(interviewDate).toISOString().split('T')[0] 
                      : ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value && value.trim() !== '') {
                        try {
                          const date = new Date(value);
                          if (!isNaN(date.getTime())) {
                            setInterviewDate(date.toISOString());
                          } else {
                            setInterviewDate('');
                          }
                        } catch {
                          setInterviewDate('');
                        }
                      } else {
                        setInterviewDate('');
                      }
                    }}
                    placeholder="mm/dd/yyyy"
                    className="w-full"
                  />
                </div>

                {/* Interview Time */}
                <div className="space-y-2">
                  <Label htmlFor="interview-time" className="flex items-center text-sm font-medium">
                    <Clock className="h-4 w-4 mr-2 text-gray-500" />
                    Interview Time
                  </Label>
                  <Input
                    id="interview-time"
                    type="time"
                    value={interviewTime}
                    onChange={(e) => setInterviewTime(e.target.value)}
                    placeholder="--:--"
                    className="w-full"
                  />
                </div>

                {/* Interview Location */}
                <div className="space-y-2">
                  <Label htmlFor="interview-location" className="flex items-center text-sm font-medium">
                    <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                    Interview Location
                  </Label>
                  <Input
                    id="interview-location"
                    type="text"
                    value={interviewLocation}
                    onChange={(e) => setInterviewLocation(e.target.value)}
                    placeholder="e.g., Office Room A, Zoom Meeting, etc."
                    className="w-full"
                  />
                </div>

                {/* Interviewer Name */}
                <div className="space-y-2">
                  <Label htmlFor="interviewer-name" className="flex items-center text-sm font-medium">
                    <User className="h-4 w-4 mr-2 text-gray-500" />
                    Interviewer Name
                  </Label>
                  <Input
                    id="interviewer-name"
                    type="text"
                    value={interviewerName}
                    onChange={(e) => setInterviewerName(e.target.value)}
                    placeholder="Enter interviewer name"
                    className="w-full"
                  />
                </div>

                {/* Interviewer Email */}
                <div className="space-y-2">
                  <Label htmlFor="interviewer-email" className="flex items-center text-sm font-medium">
                    <Mail className="h-4 w-4 mr-2 text-gray-500" />
                    Interviewer Email
                  </Label>
                  <Input
                    id="interviewer-email"
                    type="email"
                    value={interviewerEmail}
                    onChange={(e) => setInterviewerEmail(e.target.value)}
                    placeholder="Enter interviewer email"
                    className="w-full"
                  />
                </div>

                {/* Additional Interview Notes */}
                <div className="space-y-2">
                  <Label htmlFor="interview-notes" className="text-sm font-medium">
                    Additional Interview Notes
                  </Label>
                  <Textarea
                    id="interview-notes"
                    value={interviewNotes}
                    onChange={(e) => setInterviewNotes(e.target.value)}
                    placeholder="Add any additional notes about the interview..."
                    rows={4}
                    className="w-full resize-y"
                  />
                </div>

                {/* Update Button */}
                <Button
                  onClick={handleUpdateInterviewSchedule}
                  disabled={
                    savingInterview ||
                    !interviewDate?.trim() ||
                    !interviewTime?.trim() ||
                    !interviewLocation?.trim()
                  }
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {savingInterview ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Updating...
                    </>
                  ) : (
                    'Update Interview Schedule'
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Side - Document Preview - Point 3: Expanded to 60% width */}
          <div className="col-span-3 flex flex-col h-full min-h-0">
            <Card className="flex flex-col h-full min-h-0">
              <CardHeader className="flex-shrink-0 pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Documents - {application.applicant_name}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {cvPreviewUrl && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(cvPreviewUrl, '_blank')}
                          className="h-8"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Open
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            if (application.cv_file_path && cvPreviewUrl) {
                              try {
                                // Download using the signed URL
                                const response = await fetch(cvPreviewUrl);
                                const blob = await response.blob();
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = application.cv_file_path.split('/').pop() || 'cv.pdf';
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                                toast({
                                  title: 'Success',
                                  description: 'CV downloaded successfully'
                                });
                              } catch (error: any) {
                                toast({
                                  title: 'Error',
                                  description: 'Failed to download CV',
                                  variant: 'destructive'
                                });
                              }
                            }
                          }}
                          className="h-8"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col min-h-0 p-0">
                {isLoadingCv ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                      <p className="text-sm text-gray-500">Loading document...</p>
                    </div>
                  </div>
                ) : !application.cv_file_path ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <FileText className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No CV uploaded</p>
                    </div>
                  </div>
                ) : cvPreviewUrl ? (
                  <div className="flex flex-col h-full min-h-0">
                    {/* Document Controls */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 border-b flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">1 / 1</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setZoomLevel(prev => Math.max(25, prev - 10))}
                          disabled={zoomLevel <= 25}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="text-xs font-medium w-12 text-center">{zoomLevel}%</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setZoomLevel(prev => Math.min(200, prev + 10))}
                          disabled={zoomLevel >= 200}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <div className="w-px h-4 bg-gray-300 mx-1"></div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => {
                            const iframe = document.querySelector('iframe[title="CV Preview"]') as HTMLIFrameElement;
                            if (iframe) {
                              iframe.style.transform = `rotate(${(parseInt(iframe.style.transform.replace('rotate(', '').replace('deg)', '')) || 0) + 90}deg)`;
                            }
                          }}
                          title="Rotate"
                        >
                          <RotateCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setZoomLevel(100)}
                          title="Fit to page"
                        >
                          <Maximize2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {/* Document Viewer */}
                    <div className="flex-1 overflow-auto bg-gray-100 p-4 min-h-0">
                      <div className="bg-white shadow-lg mx-auto" style={{ width: `${zoomLevel}%`, transition: 'width 0.2s' }}>
                        <iframe
                          src={cvPreviewUrl}
                          className="w-full border-0"
                          style={{ minHeight: '600px', height: '100%' }}
                          title="CV Preview"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <FileText className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Failed to load CV preview</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
