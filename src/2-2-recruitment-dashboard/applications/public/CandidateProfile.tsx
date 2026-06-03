import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Dialog, DialogContent, DialogTitle } from '@/shared/components/ui/dialog';
import { CandidateProfileTabs, CandidateProfileSidebar } from '@/2-2-recruitment-dashboard/applications/candidate-form';
import { useIsMobile } from '@/mobile/shared/hooks/use-mobile';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { Loader2, User, CheckCircle, ArrowLeft, UserPlus, Monitor } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useRecruitmentCandidatePhotoDisplayUrl } from '@/shared/hooks/useRecruitmentCandidatePhotoDisplayUrl';

interface CandidateProfile {
  id: string;
  full_name: string;
  email: string;
  mobile_phone?: string;
  birth_date?: string;
  gender?: string;
  nik?: string;
  religion?: string;
  marital_status?: string;
  nationality?: string;
  blood_type?: string;
  birth_place?: string;
  address?: string;
  citizen_address?: string;
  postal_code?: string;
  recruitment_token?: string;
  profile_completed?: boolean;
  submitted_at?: string;
  photo_url?: string;
  created_at: string;
  updated_at: string;
}

const CandidateProfile = () => {
  const {
    token: paramToken,
    id: candidateId
  } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useAppTranslation();
  const [candidate, setCandidate] = useState<CandidateProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const isMobile = useIsMobile();
  const candidatePhotoDisplayUrl = useRecruitmentCandidatePhotoDisplayUrl(candidate?.photo_url, {
    width: 128,
  });

  useEffect(() => {
    // Public candidate profile route: allow document scrolling (app shell defaults to overflow-hidden).
    document.body.classList.add("allow-page-scroll");
    document.getElementById("root")?.classList.add("allow-page-scroll");
    return () => {
      document.body.classList.remove("allow-page-scroll");
      document.getElementById("root")?.classList.remove("allow-page-scroll");
    };
  }, []);

  // Detect if using the new clean layout route
  const isCleanLayout = location.pathname.startsWith('/candidate/profile');

  // Simplified data source detection with robust path fallback
  const pathMatch = location.pathname.match(/\/recruitment\/candidates\/([a-z0-9-]+)/i);
  const pathId = pathMatch?.[1] || null;
  const dataSource = candidateId || searchParams.get('id') || pathId || paramToken || searchParams.get('token');
  const isUsingId = !!(candidateId || searchParams.get('id') || pathId);

  useEffect(() => {
    // Single console log for debugging
    console.log('🔍 CandidateProfile mounted:', {
      pathname: location.pathname,
      candidateId,
      paramToken,
      queryId: searchParams.get('id'),
      queryToken: searchParams.get('token'),
      dataSource,
      isUsingId
    });
    if (dataSource) {
      if (isUsingId) {
        fetchCandidateProfile(dataSource, 'id');
      } else {
        fetchCandidateProfile(dataSource, 'token');
      }
    } else {
      console.warn('⚠️ No identifier found for candidate profile');
      toast({
        title: "Error",
        description: "Halaman tidak dapat dimuat. Silakan hubungi HR untuk mendapatkan link yang benar.",
        variant: "destructive"
      });
      setLoading(false);
    }
  }, [dataSource, isUsingId]);

  const fetchCandidateProfile = async (identifier: string, type: 'id' | 'token') => {
    if (!identifier) return;
    try {
      console.log(`🔍 Fetching candidate profile with ${type}:`, identifier);
      let profileData, profileError;
      if (type === 'id') {
        // Fetch by candidate ID (recruitment route)
        const result = await supabase.from('candidate_profiles').select('*').eq('id', identifier).single();
        profileData = result.data;
        profileError = result.error;
      } else {
        // Fetch by token (public route)
        const result = await supabase.from('candidate_profiles').select('*').eq('recruitment_token', identifier).maybeSingle();
        profileData = result.data;
        profileError = result.error;
      }
      if (profileError && profileError.code !== 'PGRST116') {
        console.error('❌ Error fetching candidate profile:', profileError);
        throw profileError;
      }

      // If not found in candidate_profiles and using token, try job_applications
      if (!profileData && type === 'token') {
        console.log('🔍 Profile not found, checking job_applications...');
        const {
          data: applicationData,
          error: applicationError
        } = await supabase.from('job_applications').select('*').eq('recruitment_token', identifier).maybeSingle();
        if (applicationError) {
          console.error('❌ Error fetching job application:', applicationError);
          throw applicationError;
        }
        if (applicationData) {
          console.log('✅ Found job application, creating candidate profile...');

          // Create candidate profile from job application data
          const appData = applicationData as any;
          const candidateData = {
            organization_id: appData.organization_id ?? null,
            full_name: appData.applicant_name,
            email: appData.applicant_email,
            mobile_phone: appData.applicant_phone,
            birth_date: appData.birth_date,
            gender: appData.gender,
            nik: appData.nik,
            recruitment_token: identifier,
            profile_completed: false,
            status: 'draft'
          };
          const {
            data: newProfile,
            error: createError
          } = await supabase.from('candidate_profiles').insert(candidateData).select().single();
          if (createError) {
            console.error('❌ Error creating candidate profile:', createError);
            throw createError;
          }
          console.log('✅ Candidate profile created:', newProfile);
          setCandidate(newProfile as unknown as CandidateProfile);
        } else {
          console.warn('⚠️ No data found for token');
          toast({
            title: "Profile Tidak Ditemukan",
            description: "Token tidak valid atau profile tidak ditemukan. Silakan hubungi HR untuk mendapatkan link yang benar.",
            variant: "destructive"
          });
        }
      } else if (!profileData) {
        // No profile found
        const errorMessage = type === 'id' ? "Kandidat tidak ditemukan atau Anda tidak memiliki akses." : "Token tidak valid atau profile tidak ditemukan. Silakan hubungi HR untuk mendapatkan link yang benar.";
        console.warn('⚠️ No profile found');
        toast({
          title: "Profile Tidak Ditemukan",
          description: errorMessage,
          variant: "destructive"
        });
      } else {
        console.log('✅ Candidate profile loaded:', profileData);
        setCandidate(profileData);
      }
    } catch (error) {
      console.error('💥 Error in fetchCandidateProfile:', error);
      const errorMessage = type === 'id' ? "Gagal memuat profile kandidat. Silakan coba lagi." : "Gagal memuat profile kandidat. Silakan coba lagi.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async (updatedData: Partial<CandidateProfile>) => {
    if (!candidate?.id) return;
    try {
      const {
        error
      } = await supabase.from('candidate_profiles').update({
        ...updatedData,
        updated_at: new Date().toISOString()
      }).eq('id', candidate.id);
      if (error) throw error;
      setCandidate(prev => prev ? {
        ...prev,
        ...updatedData
      } : null);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Gagal memperbarui profile",
        variant: "destructive"
      });
    }
  };

  // Called by CandidateProfileTabs after successful submit (Tabs perform the DB update).
  const handleFinalSubmit = () => {
    const token = searchParams.get('token') ?? paramToken ?? '';
    toast({
      title: t('candidateProfile.submitSuccess.toastTitle', 'Profil Berhasil Disubmit!'),
      description: t('candidateProfile.submitSuccess.toastDescription', 'Terima kasih telah melengkapi profil. HR akan menghubungi Anda segera.')
    });
    navigate(`/candidate/profile/thank-you${token ? `?token=${encodeURIComponent(token)}` : ''}`);
  };

  const getInitials = (name: string) => {
    if (!name) return 'CN';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Memuat profile kandidat...</p>
        </div>
      </div>;
  }

  if (!candidate) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <User className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Profile Tidak Ditemukan</h2>
            <p className="text-gray-600 mb-4">
              Token tidak valid atau profile tidak ditemukan. Silakan hubungi HR untuk mendapatkan link yang benar.
            </p>
            {dataSource && !isUsingId && <div className="text-xs text-gray-400 mb-4">
                Token: {dataSource.substring(0, 20)}...
              </div>}
            <Button onClick={() => window.close()} variant="outline">
              Tutup Halaman
            </Button>
          </CardContent>
        </Card>
      </div>;
  }

  if (location.pathname.startsWith('/recruitment/candidates/')) {
    return (
        <div className="min-h-full bg-gradient-to-br from-blue-50 via-white to-purple-50">
          {/* Compact Full-Width Header */}
          <div className="bg-white border-b border-gray-200 shadow-sm">
            <div className="w-full px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" size="sm" onClick={() => navigate('/recruitment/applications')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to Recruitment</span>
                  </Button>
                  <div className="h-4 w-px bg-gray-300" />
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={candidatePhotoDisplayUrl || undefined} alt={candidate.full_name} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                        {getInitials(candidate.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h1 className="text-xl font-semibold text-gray-900">
                        {candidate.full_name || 'Candidate Profile'}
                      </h1>
                      <p className="text-sm text-gray-600">{candidate.email}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {candidate.profile_completed && <div className="flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2 rounded-full">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">{t('candidateProfile.header.completed', 'Completed')}</span>
                    </div>}
                  
                </div>
              </div>
            </div>
          </div>

          {/* Full-Width Compact Main Layout */}
          <div className="w-full px-6 py-4">
            <div className="flex gap-4">
              {/* Compact Sidebar */}
              <div className="flex-shrink-0">
                <CandidateProfileSidebar candidateData={candidate} />
              </div>
              
              {/* Full-Width Main Content */}
              <div className="flex-1 min-w-0">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <CandidateProfileTabs candidate={candidate} onUpdate={handleProfileUpdate} isReadOnly={candidate.profile_completed || false} hideReviews={false} />
                </div>
              </div>
            </div>
          </div>
        </div>
    );
  }

  // Block mobile on /candidate/profile?token= — show desktop-only warning
  if (isCleanLayout && isMobile) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <Dialog open={true}>
          <DialogContent className="w-full max-w-[400px] rounded-xl border-2 border-slate-300 shadow-xl bg-white p-0 overflow-hidden" hideCloseButton overlayClassName="bg-slate-100/90">
            <div className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 px-6 pt-8 pb-6">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-5 ring-4 ring-slate-100/80">
                <Monitor className="h-8 w-8 text-slate-600" strokeWidth={1.5} />
              </div>
              <DialogTitle className="text-xl font-semibold text-slate-900 text-center tracking-tight">
                {t('candidateProfile.mobile.desktopOnly', 'Desktop only')}
              </DialogTitle>
            </div>
            <div className="px-6 py-5 text-center">
              <p className="text-slate-600 text-[15px] leading-relaxed">
                {t('candidateProfile.mobile.desktopMessage', 'This page is designed for desktop or laptop. Please open the same link on your computer to complete your profile.')}
              </p>
              <div className="mt-5 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-500">
                  {t('candidateProfile.mobile.keepLink', 'Keep this link and open it on a desktop browser.')}
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Clean layout for new route with sidebar - COMPACT VERSION
  if (isCleanLayout) {
    return <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        {/* Clean Header - Fixed (more reliable than sticky across scroll roots) */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-100">
          <div className="max-w-[1600px] mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={candidatePhotoDisplayUrl || undefined} alt={candidate.full_name} />
                  <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                    {getInitials(candidate.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    {t('candidateProfile.header.completeYourProfile', 'Complete Your Profile')}
                  </h1>
                  <p className="text-sm text-gray-600">
                    {candidate.full_name || t('candidateProfile.header.welcome', 'Welcome')}
                  </p>
                </div>
              </div>
              
              {candidate.profile_completed && <div className="flex items-center space-x-2 text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-xs font-medium">{t('candidateProfile.header.completed', 'Completed')}</span>
                </div>}
            </div>
          </div>
        </div>

        {/* Main Content with Sidebar - COMPACT */}
        {/* pad top so content doesn't go under fixed header */}
        <div className="max-w-[1600px] mx-auto px-4 pt-20 pb-4">
          <div className="flex gap-4">
            {/* Sidebar - Wider and Compact */}
            <div className="sticky top-24 h-fit w-96 flex-shrink-0">
              <CandidateProfileSidebar candidateData={candidate} />
            </div>
            
            {/* Main Content - Compact */}
            <div className="flex-1 min-w-0">
              <div className="bg-white/60 backdrop-blur-sm rounded-xl shadow-sm border border-white/20 overflow-hidden p-4">
                <CandidateProfileTabs 
                  candidate={candidate} 
                  onUpdate={handleProfileUpdate} 
                  isReadOnly={candidate.profile_completed || false} 
                  hideReviews={true}
                  onFinalSubmit={handleFinalSubmit}
                />
              </div>
            </div>
          </div>
        </div>
      </div>;
  }

  // Original layout for backward compatibility - MADE WIDER
  return <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Avatar className="h-8 w-8">
                <AvatarImage src={candidatePhotoDisplayUrl || undefined} alt={candidate.full_name} />
                <AvatarFallback className="bg-blue-600 text-white">
                  {getInitials(candidate.full_name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {t('candidateProfile.header.profileKandidat', 'Profile Kandidat')}
                </h1>
                <p className="text-sm text-gray-600">
                  {candidate.full_name || t('candidateProfile.header.completeNamePlaceholder', 'Mohon lengkapi nama Anda')}
                </p>
              </div>
            </div>
            
            {candidate.profile_completed && <div className="flex items-center space-x-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm font-medium">{t('candidateProfile.header.profileCompleted', 'Profile Completed')}</span>
              </div>}
          </div>
        </div>
      </div>

      {/* Content - MADE WIDER */}
      <div className="max-w-[1400px] mx-auto p-4">
        <CandidateProfileTabs candidate={candidate} onUpdate={handleProfileUpdate} isReadOnly={candidate.profile_completed || false} hideReviews={false} />
      </div>
    </div>;
};

export default CandidateProfile;
