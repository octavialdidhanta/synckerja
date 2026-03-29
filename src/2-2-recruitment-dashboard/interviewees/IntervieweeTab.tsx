import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Calendar, Clock, MapPin, User, Search, Filter, Star, MoreHorizontal, Eye, UserPlus, Trash2, MessageSquare, AlertTriangle, Download } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { supabase } from '@/shared/lib/supabaseClient';
import { getDiscResultFromScores } from '@/shared/lib/discResultUtils';
import { getSjtResultFromScores, getDimensionDisplayValue, SJT_DIMENSION_LABELS, type SjtDimensionKey } from '@/shared/lib/sjtResultUtils';
import { useToast } from '@/shared/components/ui/use-toast';
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { InterviewWhatsAppButton } from './InterviewWhatsAppButton';
import { useNavigate } from 'react-router-dom';
import { CandidateToEmployeeConfirmModal } from './CandidateToEmployeeConfirmModal';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { fetchCandidateApplicationData } from './services/candidateApplicationPdfService';
import { generateCandidateApplicationPDF } from './utils/candidateApplicationPdfGenerator';

interface InterviewCandidate {
  id: string;
  applicant_name: string;
  applicant_email: string;
  applicant_phone: string;
  birth_date?: string;
  gender?: string;
  nik?: string;
  status: string;
  created_at: string;
  interview_date?: string;
  interview_time?: string;
  interview_location?: string;
  interviewer_name?: string;
  interviewer_email?: string;
  interview_status: string;
  interview_notes?: string;
  job_openings?: {
    job_title: string;
  };
  candidate_profile_id?: string;
  recruitment_token: string;
  candidate_profiles?: {
    profile_completed: boolean;
    recruitment_token: string;
    full_name: string;
    photo_url?: string;
  };
  average_score?: number;
  total_reviews?: number;
  disc_scores?: { score_d: number; score_i: number; score_s: number; score_c: number };
  cognitive_scores?: { score_total: number; score_verbal?: number; score_numerical?: number; score_logical?: number };
  sjt_scores?: { score_sjt: number; sjt_dimension_scores?: Record<string, number> };
}

interface CandidateActionsDropdownProps {
  candidate: InterviewCandidate;
  onViewProfile: () => void;
  onDownloadApplication: () => void;
  onAddAsEmployee: () => void;
  onDelete: () => void;
  onWhatsApp: () => void;
  hasReviews: boolean;
  downloadApplicationLabel: string;
  /** Only owner role can delete; when false, Delete option is hidden */
  canDelete?: boolean;
}

const CandidateActionsDropdown = ({
  onViewProfile,
  onDownloadApplication,
  onAddAsEmployee,
  onDelete,
  onWhatsApp,
  hasReviews,
  downloadApplicationLabel,
  canDelete = false,
}: CandidateActionsDropdownProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-white border shadow-lg">
        <DropdownMenuItem onClick={onViewProfile} className="cursor-pointer">
          <Eye className="mr-2 h-4 w-4" />
          View Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDownloadApplication} className="cursor-pointer">
          <Download className="mr-2 h-4 w-4" />
          {downloadApplicationLabel}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={onAddAsEmployee} 
          className={`cursor-pointer ${!hasReviews ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={!hasReviews}
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Add As Employee
          {!hasReviews && <AlertTriangle className="ml-2 h-3 w-3 text-amber-500" />}
        </DropdownMenuItem>
        {canDelete && (
          <DropdownMenuItem onClick={onDelete} className="cursor-pointer text-red-600">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onWhatsApp} className="cursor-pointer">
          <MessageSquare className="mr-2 h-4 w-4" />
          WhatsApp
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export type IntervieweeTabProps = {
  onLoadingChange?: (loading: boolean) => void;
};

export const IntervieweeTab = ({ onLoadingChange }: IntervieweeTabProps) => {
  const [candidates, setCandidates] = useState<InterviewCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedCandidate, setSelectedCandidate] = useState<InterviewCandidate | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [candidateToDelete, setCandidateToDelete] = useState<InterviewCandidate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [discModalCandidate, setDiscModalCandidate] = useState<InterviewCandidate | null>(null);
  const [sjtModalCandidate, setSjtModalCandidate] = useState<InterviewCandidate | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t, language } = useAppTranslation();
  const { isOwner } = useCentralizedUserData();
  const { organizationId } = useCurrentOrg();
  const [downloadingPdfForId, setDownloadingPdfForId] = useState<string | null>(null);

  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  /** Short dynamic description of cognitive test result (translatable). */
  const getCognitiveScoreDescription = (scores: InterviewCandidate['cognitive_scores']): string => {
    if (scores == null) return '';
    const total = Number(scores.score_total ?? 0);
    const v = scores.score_verbal ?? 0;
    const n = scores.score_numerical ?? 0;
    const l = scores.score_logical ?? 0;
    const hasBreakdown = v > 0 || n > 0 || l > 0;
    if (hasBreakdown) {
      return t('interviewees.cognitiveScoreShort', 'Skor {{total}}/30 — Verbal {{v}} benar, Numerical {{n}} benar, Logical {{l}} benar', { total, v, n, l });
    }
    return t('interviewees.cognitiveScoreTotalOnly', 'Skor {{total}}/30', { total });
  };

  useEffect(() => {
    fetchInterviewees();
  }, [organizationId]);

  const fetchInterviewees = async () => {
    setLoading(true);
    try {
      console.log('🔍 Fetching interviewees...');
      
      if (!organizationId) {
        setCandidates([]);
        setLoading(false);
        return;
      }

      // First, get completed candidate profiles for current organization only
      const { data: candidateProfiles, error: profileError } = await supabase
        .from('candidate_profiles')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('profile_completed', true)
        .not('recruitment_token', 'is', null);

      if (profileError) {
        console.error('❌ Error fetching candidate profiles:', profileError);
        throw profileError;
      }

      console.log('✅ Found completed candidate profiles:', candidateProfiles);

      if (!candidateProfiles || candidateProfiles.length === 0) {
        console.log('No completed candidate profiles found');
        setCandidates([]);
        setLoading(false);
        return;
      }

      // Get recruitment tokens
      const recruitmentTokens = candidateProfiles.map(profile => (profile as any).recruitment_token).filter(Boolean);
      
      // Now get job applications for these candidates (scoped to current organization)
      const { data: jobApplications, error: applicationError } = await supabase
        .from('job_applications')
        .select(`
          *,
          job_openings (
            job_title
          )
        `)
        .eq('organization_id', organizationId)
        .in('recruitment_token', recruitmentTokens)
        .order('created_at', { ascending: false });

      if (applicationError) {
        console.error('❌ Error fetching job applications:', applicationError);
        throw applicationError;
      }

      console.log('✅ Found job applications:', jobApplications);

      // Get candidate profile IDs for reviews
      const candidateProfileIds = candidateProfiles.map(p => (p as any).id);
      
      // Fetch reviews for all candidates
      const { data: reviews, error: reviewsError } = await supabase
        .from('candidate_reviews')
        .select('candidate_profile_id, rating')
        .in('candidate_profile_id', candidateProfileIds);

      if (reviewsError) {
        console.error('❌ Error fetching reviews:', reviewsError);
      }

      console.log('✅ Found reviews:', reviews);

      // Calculate average scores for each candidate
      const candidateScores = candidateProfileIds.reduce((acc, profileId) => {
        const candidateReviews = reviews?.filter(r => (r as any).candidate_profile_id === profileId) || [];
        if (candidateReviews.length > 0) {
          const avgScore = candidateReviews.reduce((sum, review) => sum + ((review as any).rating || 0), 0) / candidateReviews.length;
          acc[profileId] = {
            average_score: Math.round(avgScore * 10) / 10, // Round to 1 decimal place
            total_reviews: candidateReviews.length
          };
        }
        return acc;
      }, {} as Record<string, { average_score: number; total_reviews: number }>);

      // Fetch test IDs for DISC, cognitive, and SJT
      const { data: testsMeta } = await supabase
        .from('tests')
        .select('id, type')
        .in('type', ['disc', 'cognitive', 'sjt'])
        .eq('is_active', true);
      const testList = (testsMeta || []) as { id: string; type: string }[];
      const discTestId = testList.find(t => t.type === 'disc')?.id;
      const cognitiveTestId = testList.find(t => t.type === 'cognitive')?.id;
      const sjtTestId = testList.find(t => t.type === 'sjt')?.id;

      // Fetch DISC test scores (only rows for DISC test)
      const discByProfile: Record<string, { score_d: number; score_i: number; score_s: number; score_c: number }> = {};
      if (discTestId) {
        const { data: discRows } = await supabase
          .from('candidate_tests')
          .select('candidate_profile_id, score_d, score_i, score_s, score_c')
          .in('candidate_profile_id', candidateProfileIds)
          .eq('test_id', discTestId)
          .eq('status', 'submitted');
        (discRows || []).forEach((row: any) => {
          discByProfile[row.candidate_profile_id] = {
            score_d: Number(row.score_d ?? 0),
            score_i: Number(row.score_i ?? 0),
            score_s: Number(row.score_s ?? 0),
            score_c: Number(row.score_c ?? 0)
          };
        });
      }

      // Fetch cognitive test scores (only rows for cognitive test)
      const cognitiveByProfile: Record<string, { score_total: number; score_verbal?: number; score_numerical?: number; score_logical?: number }> = {};
      if (cognitiveTestId) {
        const { data: cogRows } = await supabase
          .from('candidate_tests')
          .select('candidate_profile_id, score_total, score_verbal, score_numerical, score_logical')
          .in('candidate_profile_id', candidateProfileIds)
          .eq('test_id', cognitiveTestId)
          .eq('status', 'submitted');
        (cogRows || []).forEach((row: any) => {
          cognitiveByProfile[row.candidate_profile_id] = {
            score_total: Number(row.score_total ?? 0),
            score_verbal: row.score_verbal != null ? Number(row.score_verbal) : undefined,
            score_numerical: row.score_numerical != null ? Number(row.score_numerical) : undefined,
            score_logical: row.score_logical != null ? Number(row.score_logical) : undefined
          };
        });
      }

      // Fetch SJT test scores (including dimension scores for candidate description)
      const sjtByProfile: Record<string, { score_sjt: number; sjt_dimension_scores?: Record<string, number> }> = {};
      if (sjtTestId) {
        const { data: sjtRows } = await supabase
          .from('candidate_tests')
          .select('candidate_profile_id, score_sjt, sjt_dimension_scores')
          .in('candidate_profile_id', candidateProfileIds)
          .eq('test_id', sjtTestId)
          .eq('status', 'submitted');
        (sjtRows || []).forEach((row: any) => {
          sjtByProfile[row.candidate_profile_id] = {
            score_sjt: Number(row.score_sjt ?? 0),
            sjt_dimension_scores: row.sjt_dimension_scores ?? undefined
          };
        });
      }

      // Merge candidate profile data with job application data and scores
      const mergedData = jobApplications?.map((application: any) => {
        const profile = candidateProfiles.find(p => (p as any).recruitment_token === (application as any).recruitment_token);
        const scoreData = profile ? candidateScores[(profile as any).id] : null;
        const profileId = (profile as any)?.id ?? (application as any).candidate_profile_id;
        return {
          ...(application as object),
          candidate_profile_id: profileId,
          // Use profile data as primary source
          applicant_name: (profile as any)?.full_name || (application as any).applicant_name,
          applicant_email: (profile as any)?.email || (application as any).applicant_email,
          applicant_phone: (profile as any)?.mobile_phone || (application as any).applicant_phone,
          birth_date: (profile as any)?.birth_date || (application as any).birth_date,
          gender: (profile as any)?.gender || (application as any).gender,
          nik: (profile as any)?.nik || (application as any).nik,
          candidate_profiles: {
            profile_completed: (profile as any)?.profile_completed || false,
            recruitment_token: (profile as any)?.recruitment_token || '',
            full_name: (profile as any)?.full_name || '',
            photo_url: (profile as any)?.photo_url || null
          },
          average_score: scoreData?.average_score || 0,
          total_reviews: scoreData?.total_reviews || 0,
          disc_scores: profileId ? discByProfile[profileId] : undefined,
          cognitive_scores: profileId ? cognitiveByProfile[profileId] : undefined,
          sjt_scores: profileId ? sjtByProfile[profileId] : undefined
        };
      }) || [];
      
      setCandidates(mergedData as unknown as InterviewCandidate[]);
      console.log('✅ Processed candidate data with scores:', mergedData);
    } catch (error) {
      console.error('💥 Error in fetchInterviewees:', error);
      toast({
        title: "Error fetching interviewees",
        description: "Could not load interview candidates. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateInterviewStatus = async (candidateId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('job_applications')
        .update({ 
          interview_status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', candidateId);

      if (error) throw error;

      setCandidates(prev => prev.map(candidate => 
        candidate.id === candidateId 
          ? { ...candidate, interview_status: newStatus }
          : candidate
      ));

      toast({
        title: "Status Updated",
        description: `Interview status changed to ${newStatus}`
      });
    } catch (error) {
      console.error('Error updating interview status:', error);
      toast({
        title: "Update Error",
        description: "Could not update interview status. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleViewProfile = (candidate: InterviewCandidate) => {
    if (candidate.candidate_profile_id) {
      navigate(`/recruitment/candidates/${candidate.candidate_profile_id}`);
      return;
    }
    toast({
      title: "Profile not available",
      description: "This candidate does not have a profile yet. Profile will be available after the candidate completes their profile.",
      variant: "destructive"
    });
  };

  const handleAddAsEmployee = (candidate: InterviewCandidate) => {
    // Check if candidate has reviews
    if (!candidate.total_reviews || candidate.total_reviews === 0) {
      toast({
        title: "Reviews Required",
        description: "Kandidat harus memiliki review terlebih dahulu sebelum dapat dijadikan karyawan. Silakan tambahkan review di tab Reviews pada profil kandidat.",
        variant: "destructive"
      });
      return;
    }

    setSelectedCandidate(candidate);
    setShowConfirmModal(true);
  };

  const handleConfirmAddAsEmployee = async () => {
    if (!selectedCandidate?.candidate_profile_id) return;
    
    setIsProcessing(true);
    console.log('[FRONTEND] Starting candidate to employee migration for:', selectedCandidate.candidate_profile_id);

    // Show initial processing toast
    toast({
      title: 'Processing Migration',
      description: 'Starting candidate migration to employee...'
    });
    
    try {
      console.log('[FRONTEND] Calling migrate-candidate-to-employee function...');
      const { data, error } = await supabase.functions.invoke('migrate-candidate-to-employee', {
        body: { candidateProfileId: selectedCandidate.candidate_profile_id }
      });

      console.log('[FRONTEND] Migration response:', { data, error });

      if (error) {
        console.error('[FRONTEND] Migration error:', error);
        throw new Error(error.message || 'Migration failed');
      }

      if (data?.success) {
        console.log('[FRONTEND] Migration successful:', data);
        
        toast({
          title: 'Migration Successful! ✅',
          description: `${selectedCandidate.applicant_name} has been successfully converted to an employee.`
        });

        await fetchInterviewees();
      } else {
        console.error('[FRONTEND] Migration failed:', data);
        throw new Error(data?.error || 'Migration failed for unknown reason');
      }
    } catch (error: any) {
      console.error('[FRONTEND] Error migrating candidate:', error);
      toast({
        title: 'Migration Failed ❌',
        description: error.message || 'Failed to migrate candidate to employee',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
      setShowConfirmModal(false);
      setSelectedCandidate(null);
    }
  };

  const handleDeleteClick = (candidate: InterviewCandidate) => {
    setCandidateToDelete(candidate);
  };

  const handleDeleteConfirm = async () => {
    if (!candidateToDelete) return;
    setDeleting(true);
    const profileIdToDelete = candidateToDelete.candidate_profile_id;
    try {
      const { error: appError } = await supabase
        .from('job_applications')
        .delete()
        .eq('id', candidateToDelete.id);

      if (appError) throw appError;

      if (profileIdToDelete) {
        const { data: remainingApps } = await supabase
          .from('job_applications')
          .select('id')
          .eq('candidate_profile_id', profileIdToDelete)
          .limit(1);
        if (!remainingApps?.length) {
          const { error: profileError } = await supabase
            .from('candidate_profiles')
            .delete()
            .eq('id', profileIdToDelete);
          if (profileError) {
            console.error('Error deleting candidate profile:', profileError);
            toast({
              title: "Warning",
              description: "Application removed but candidate profile could not be deleted.",
              variant: "destructive"
            });
          }
        }
      }

      setCandidateToDelete(null);
      await fetchInterviewees();
      toast({
        title: "Success",
        description: "Interviewee has been removed."
      });
    } catch (error) {
      console.error('Error deleting interviewee:', error);
      toast({
        title: "Error",
        description: "Failed to remove interviewee. Please try again.",
        variant: "destructive"
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleDownloadApplication = async (candidate: InterviewCandidate) => {
    const profileId = candidate.candidate_profile_id;
    const token = candidate.recruitment_token;
    if (!profileId || !token) {
      toast({
        title: "Error",
        description: "Candidate profile or application data is missing. Cannot generate PDF.",
        variant: "destructive"
      });
      return;
    }
    setDownloadingPdfForId(candidate.id);
    toast({
      title: t('candidateApplicationPdf.generating', 'Generating PDF...'),
      description: undefined
    });
    try {
      const data = await fetchCandidateApplicationData(profileId, token);
      if (!data.profile) {
        toast({
          title: "Error",
          description: "Candidate profile not found.",
          variant: "destructive"
        });
        return;
      }
      const translate = (key: string, fallback: string) => t(key, fallback);
      const { blob, filename } = await generateCandidateApplicationPDF(data, language, translate);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Success",
        description: "PDF downloaded successfully."
      });
    } catch (err: unknown) {
      console.error('Error generating application PDF:', err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to generate PDF.",
        variant: "destructive"
      });
    } finally {
      setDownloadingPdfForId(null);
    }
  };

  const handleWhatsApp = (candidate: InterviewCandidate) => {
    const positionTitle = candidate.job_openings?.job_title || 'the position';
    const message = `*INTERVIEW INVITATION*
━━━━━━━━━━━━━━━━━━━━━━━━━

Dear *${candidate.applicant_name}*,

Thank you for your interest in the *${positionTitle}* position with our organization.

We have reviewed your application and would like to invite you for an interview to discuss your qualifications further.

**Next Steps:**
• Please confirm your availability for the interview
• We will schedule a convenient time for both parties
• Additional details will be provided upon confirmation

Best regards,
*HR Recruitment Team*

━━━━━━━━━━━━━━━━━━━━━━━━━
*Please reply to confirm your availability*`;

    const phoneNumber = candidate.applicant_phone?.replace(/[^\d]/g, '');
    window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
    updateInterviewStatus(candidate.id, 'contacted');
  };

  const filteredCandidates = candidates.filter(candidate => {
    const matchesSearch = 
      candidate.applicant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      candidate.applicant_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      candidate.job_openings?.job_title.toLowerCase().includes(searchTerm.toLowerCase());
    
    const effectiveStatus = (c: InterviewCandidate) =>
      ((c.average_score != null && c.average_score > 0) || (c.total_reviews != null && c.total_reviews > 0)) ? 'interviewed' : c.interview_status;
    const matchesStatus = statusFilter === 'all' || effectiveStatus(candidate) === statusFilter;
    
    const matchesScore = scoreFilter === 'all' || 
      (scoreFilter === 'high' && candidate.average_score >= 4) ||
      (scoreFilter === 'medium' && candidate.average_score >= 2.5 && candidate.average_score < 4) ||
      (scoreFilter === 'low' && candidate.average_score < 2.5) ||
      (scoreFilter === 'no_reviews' && candidate.total_reviews === 0);

    const matchesDate = dateFilter === 'all' ||
      (dateFilter === 'recent' && new Date(candidate.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) ||
      (dateFilter === 'older' && new Date(candidate.created_at) <= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    
    return matchesSearch && matchesStatus && matchesScore && matchesDate;
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'not_scheduled': { label: 'Not Scheduled', variant: 'secondary' as const, className: '' },
      'scheduled': { label: 'Scheduled', variant: 'default' as const, className: '' },
      'interviewed': { label: 'Interviewed', variant: 'default' as const, className: 'bg-green-600 text-white border-green-600 hover:bg-green-700' },
      'completed': { label: 'Completed', variant: 'default' as const, className: '' },
      'cancelled': { label: 'Cancelled', variant: 'destructive' as const, className: '' },
      'rescheduled': { label: 'Rescheduled', variant: 'secondary' as const, className: '' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || { label: status, variant: 'secondary' as const, className: '' };
    return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
  };

  /** If candidate has at least one review/score, show as Interviewed. */
  const getEffectiveInterviewStatus = (candidate: InterviewCandidate): string => {
    const hasScore = (candidate.average_score != null && candidate.average_score > 0) || (candidate.total_reviews != null && candidate.total_reviews > 0);
    return hasScore ? 'interviewed' : candidate.interview_status;
  };

  const renderScoreStars = (score: number) => {
    const stars = [];
    const fullStars = Math.floor(score);
    const hasHalfStar = score % 1 >= 0.5;
    
    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />);
      } else if (i === fullStars && hasHalfStar) {
        stars.push(<Star key={i} className="h-3 w-3 fill-yellow-400/50 text-yellow-400" />);
      } else {
        stars.push(<Star key={i} className="h-3 w-3 text-gray-300" />);
      }
    }
    return stars;
  };

  if (loading) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white border rounded-md p-2">
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <div className="relative flex-1 min-w-[150px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search candidates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full h-9 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[130px] h-9 text-sm">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="not_scheduled">Not Scheduled</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="interviewed">Interviewed</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={scoreFilter} onValueChange={setScoreFilter}>
            <SelectTrigger className="w-full sm:w-[130px] h-9 text-sm">
              <Star className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Score" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Scores</SelectItem>
              <SelectItem value="high">High (4-5★)</SelectItem>
              <SelectItem value="medium">Medium (2.5-4★)</SelectItem>
              <SelectItem value="low">Low (&lt;2.5★)</SelectItem>
              <SelectItem value="no_reviews">No Reviews</SelectItem>
            </SelectContent>
          </Select>

          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-full sm:w-[130px] h-9 text-sm">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dates</SelectItem>
              <SelectItem value="recent">Recent (7 days)</SelectItem>
              <SelectItem value="older">Older</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredCandidates.length === 0 ? (
        <div className="text-center py-12">
          <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <div className="text-gray-500">
            <p className="text-lg font-medium">Tidak ada kandidat interview</p>
            <p className="text-sm mt-1">
              {candidates.length === 0 
                ? "Belum ada kandidat yang sudah melengkapi profile dan siap untuk interview." 
                : "Tidak ada kandidat yang cocok dengan filter pencarian."}
            </p>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-full bg-white border rounded-lg overflow-hidden max-h-[calc(100vh-200px)] flex flex-col min-w-0">
          <div className="w-full max-w-full flex-1 min-h-0 min-w-0 overflow-x-auto overflow-y-auto seamless-scroll nested-scroll-touch-chain">
            <Table className="min-w-[1280px]">
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold whitespace-nowrap min-w-[160px] px-4 py-3">Name</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap min-w-[180px] px-4 py-3">Email</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap min-w-[120px] px-4 py-3">Phone</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap min-w-[100px] px-4 py-3">Profile</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap min-w-[160px] px-4 py-3">Position</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap min-w-[120px] px-4 py-3">DISC</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap min-w-[90px] px-4 py-3">Kognitif</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap min-w-[80px] px-4 py-3">SJT</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap min-w-[100px] px-4 py-3">Score</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap min-w-[100px] px-4 py-3">Application Status</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap min-w-[100px] px-4 py-3">Interview Status</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap min-w-[110px] px-4 py-3">Interview Date</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap min-w-[90px] px-4 py-3">Time</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap min-w-[160px] px-4 py-3">Location</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap min-w-[120px] px-4 py-3">Interviewer</TableHead>
                  <TableHead className="font-semibold whitespace-nowrap min-w-[80px] px-4 py-3 text-center sticky right-0 bg-gray-50">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCandidates.map(candidate => (
                  <TableRow key={candidate.id} className="hover:bg-gray-50 border-b border-gray-100">
                    <TableCell className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-9 w-9 flex-shrink-0">
                          <AvatarImage src={candidate.candidate_profiles?.photo_url || ''} alt={candidate.applicant_name} />
                          <AvatarFallback className="bg-blue-100 text-blue-600 text-xs font-medium">
                            {candidate.applicant_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-gray-900 truncate">{candidate.applicant_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                      <span className="truncate block max-w-[180px]" title={candidate.applicant_email}>{candidate.applicant_email || '—'}</span>
                    </TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                      {candidate.applicant_phone || '—'}
                    </TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-green-600 font-medium">✅ Completed</span>
                    </TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap">
                      <span className="font-medium text-gray-900 text-sm">
                        {candidate.job_openings?.job_title || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {candidate.disc_scores ? (
                        <button
                          type="button"
                          onClick={() => setDiscModalCandidate(candidate)}
                          className="font-mono text-xs text-left hover:underline focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 -mx-1"
                          title="Lihat deskripsi & job match"
                        >
                          D:{Number(candidate.disc_scores.score_d).toFixed(0)} I:{Number(candidate.disc_scores.score_i).toFixed(0)} S:{Number(candidate.disc_scores.score_s).toFixed(0)} C:{Number(candidate.disc_scores.score_c).toFixed(0)}
                        </button>
                      ) : (
                        <span className="text-gray-400">Belum tes</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-600 max-w-[200px]" title={candidate.cognitive_scores != null ? getCognitiveScoreDescription(candidate.cognitive_scores) : undefined}>
                      {candidate.cognitive_scores != null ? (
                        <span className="text-xs leading-tight block">
                          <span className="font-mono font-medium">{candidate.cognitive_scores.score_total}/30</span>
                          {(candidate.cognitive_scores.score_verbal != null || candidate.cognitive_scores.score_numerical != null || candidate.cognitive_scores.score_logical != null) && (
                            <span className="text-gray-500 block mt-0.5">
                              V:{candidate.cognitive_scores.score_verbal ?? 0} N:{candidate.cognitive_scores.score_numerical ?? 0} L:{candidate.cognitive_scores.score_logical ?? 0}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-600" title={candidate.sjt_scores != null && candidate.sjt_scores.sjt_dimension_scores ? getSjtResultFromScores(candidate.sjt_scores.sjt_dimension_scores).description : candidate.sjt_scores != null ? `Skor Situasi Kerja: ${candidate.sjt_scores.score_sjt}/12` : undefined}>
                      {candidate.sjt_scores != null ? (
                        <button
                          type="button"
                          onClick={() => candidate.sjt_scores && setSjtModalCandidate(candidate)}
                          className="font-mono text-xs text-left hover:underline focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 -mx-1"
                          title="Lihat deskripsi & rekomendasi peran"
                        >
                          {candidate.sjt_scores.score_sjt}/12
                        </button>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col items-start gap-0.5">
                        {candidate.total_reviews > 0 ? (
                          <>
                            <div className="flex items-center space-x-0.5">
                              {renderScoreStars(candidate.average_score || 0)}
                            </div>
                            <span className="text-xs text-gray-600">
                              {candidate.average_score?.toFixed(1)} / 5.0 ({candidate.total_reviews})
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">No reviews yet</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap">
                      <Badge variant="outline" className="text-xs capitalize">
                        {candidate.status || '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap">
                      {getStatusBadge(getEffectiveInterviewStatus(candidate))}
                    </TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm">
                      {candidate.interview_date
                        ? new Date(candidate.interview_date).toLocaleDateString()
                        : '—'}
                    </TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm">
                      {candidate.interview_time || '—'}
                    </TableCell>
                    <TableCell className="px-4 py-3 min-w-[160px] max-w-[200px]">
                      <span className="text-sm text-gray-700 truncate block" title={candidate.interview_location || ''}>
                        {candidate.interview_location || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm">
                      {candidate.interviewer_name || '—'}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center sticky right-0 bg-white hover:bg-gray-50">
                      <CandidateActionsDropdown
                        candidate={candidate}
                        onViewProfile={() => handleViewProfile(candidate)}
                        onDownloadApplication={() => handleDownloadApplication(candidate)}
                        onAddAsEmployee={() => handleAddAsEmployee(candidate)}
                        onDelete={() => handleDeleteClick(candidate)}
                        canDelete={isOwner}
                        onWhatsApp={() => handleWhatsApp(candidate)}
                        hasReviews={(candidate.total_reviews || 0) > 0}
                        downloadApplicationLabel={t('candidateApplicationPdf.downloadApplication', 'Download Application')}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog - owner only */}
      <AlertDialog open={!!candidateToDelete} onOpenChange={(open) => !open && setCandidateToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove interviewee?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the application record for {candidateToDelete?.applicant_name}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteConfirm();
              }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DISC result modal: deskripsi & job match */}
      <Dialog open={!!discModalCandidate} onOpenChange={(open) => !open && setDiscModalCandidate(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Hasil DISC — {discModalCandidate?.applicant_name ?? ''}
            </DialogTitle>
          </DialogHeader>
          {discModalCandidate?.disc_scores && (
            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="font-mono font-medium px-2 py-1 rounded bg-red-100 text-red-800">D: {Number(discModalCandidate.disc_scores.score_d).toFixed(0)}</span>
                <span className="font-mono font-medium px-2 py-1 rounded bg-amber-100 text-amber-800">I: {Number(discModalCandidate.disc_scores.score_i).toFixed(0)}</span>
                <span className="font-mono font-medium px-2 py-1 rounded bg-green-100 text-green-800">S: {Number(discModalCandidate.disc_scores.score_s).toFixed(0)}</span>
                <span className="font-mono font-medium px-2 py-1 rounded bg-blue-100 text-blue-800">C: {Number(discModalCandidate.disc_scores.score_c).toFixed(0)}</span>
              </div>
              {(() => {
                const { description, jobMatch, level, caveats } = getDiscResultFromScores(discModalCandidate.disc_scores);
                return (
                  <>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">Rekomendasi Level</h4>
                      <p className="text-sm text-gray-700">{level}</p>
                    </div>
                    <div className="border border-green-200 rounded-md p-3 bg-green-50/50">
                      <h4 className="font-semibold text-gray-900 mb-1">Deskripsi Kepribadian</h4>
                      <p className="text-sm text-gray-700 leading-relaxed">{description}</p>
                    </div>
                    {caveats && (
                      <div className="border border-amber-200 rounded-md p-3 bg-amber-50/70">
                        <h4 className="font-semibold text-amber-900 mb-1">Catatan</h4>
                        <p className="text-sm text-gray-700 leading-relaxed">{caveats}</p>
                      </div>
                    )}
                    <div className="border border-green-200 rounded-md p-3 bg-green-50/50">
                      <h4 className="font-semibold text-gray-900 mb-1">Job Match</h4>
                      <p className="text-sm text-gray-700">{jobMatch}</p>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* SJT result modal: deskripsi & rekomendasi peran */}
      <Dialog open={!!sjtModalCandidate} onOpenChange={(open) => !open && setSjtModalCandidate(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Hasil Tes Situasi Kerja — {sjtModalCandidate?.applicant_name ?? ''}
            </DialogTitle>
          </DialogHeader>
          {sjtModalCandidate?.sjt_scores && (
            <div className="space-y-4 pt-2">
              <p className="font-medium text-gray-900">
                Skor: {sjtModalCandidate.sjt_scores.score_sjt}/12
              </p>
              {sjtModalCandidate.sjt_scores.sjt_dimension_scores && (() => {
                const dims = sjtModalCandidate.sjt_scores.sjt_dimension_scores;
                const result = getSjtResultFromScores(dims);
                const dimensionKeys: SjtDimensionKey[] = ['etika', 'komunikasi', 'prioritas', 'konflik', 'prosedur'];
                return (
                  <>
                    <div className="flex flex-wrap gap-2 text-sm">
                      {dimensionKeys.map((key) => (
                        <span key={key} className="font-mono font-medium px-2 py-1 rounded bg-gray-100 text-gray-800">
                          {SJT_DIMENSION_LABELS[key]}: {getDimensionDisplayValue(dims as Record<string, unknown>, key)}
                        </span>
                      ))}
                    </div>
                    <div className="border border-green-200 rounded-md p-3 bg-green-50/50">
                      <h4 className="font-semibold text-gray-900 mb-1">Deskripsi Kandidat</h4>
                      <p className="text-sm text-gray-700 leading-relaxed">{result.description}</p>
                    </div>
                    <div className="border border-green-200 rounded-md p-3 bg-green-50/50">
                      <h4 className="font-semibold text-gray-900 mb-1">Rekomendasi Peran</h4>
                      <p className="text-sm text-gray-700">{result.jobMatch}</p>
                    </div>
                    {result.caveats && (
                      <div className="border border-amber-200 rounded-md p-3 bg-amber-50/70">
                        <h4 className="font-semibold text-amber-900 mb-1">Catatan</h4>
                        <p className="text-sm text-gray-700 leading-relaxed">{result.caveats}</p>
                      </div>
                    )}
                  </>
                );
              })()}
              {!sjtModalCandidate.sjt_scores.sjt_dimension_scores && (
                <p className="text-sm text-gray-500">Deskripsi berdasarkan dimensi belum tersedia untuk tes ini.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal */}
      {selectedCandidate && (
        <CandidateToEmployeeConfirmModal
          open={showConfirmModal}
          onOpenChange={setShowConfirmModal}
          candidateName={selectedCandidate.applicant_name}
          candidateScore={selectedCandidate.average_score || 0}
          scoreCount={selectedCandidate.total_reviews || 0}
          onConfirm={handleConfirmAddAsEmployee}
          isProcessing={isProcessing}
        />
      )}
    </div>
  );
};
