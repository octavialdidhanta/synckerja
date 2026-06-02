import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Badge } from '@/shared/components/ui/badge';
import { User, Mail, Phone, Calendar, MapPin, Briefcase } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { cn } from '@/shared/lib/utils';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { createStorageDisplayUrl } from '@/shared/lib/storageDisplayUrl';

// Layout constants - COMPACT VERSION
const LAYOUT_CONSTANTS = {
  sidebar: {
    width: 'w-full',
    minHeight: 'min-h-0'
  },
  card: {
    margin: 'mb-3',
    paddingSmall: 'p-3',
    gapSmall: 'space-y-1.5'
  },
  margin: {
    sm: 'mb-1.5'
  },
  padding: {
    md: 'p-3'
  }
};

// Professional colors
const PROFESSIONAL_COLORS = {
  background: {
    secondary: 'bg-gray-50',
    card: 'bg-white'
  },
  text: {
    heading: 'text-gray-900',
    secondary: 'text-gray-600'
  },
  shadow: {
    sm: 'shadow-sm'
  },
  border: {
    default: 'border-gray-200',
    muted: 'border-gray-100'
  }
};

interface CandidateProfileSidebarProps {
  candidateData: {
    id?: string;
    full_name?: string;
    email?: string;
    mobile_phone?: string;
    birth_date?: string;
    birth_place?: string;
    gender?: string;
    nik?: string;
    religion?: string;
    marital_status?: string;
    nationality?: string;
    blood_type?: string;
    address?: string;
    citizen_address?: string;
    postal_code?: string;
    photo_url?: string;
    employment_status?: string;
    profile_completed?: boolean;
  };
}

export const CandidateProfileSidebar = ({ candidateData }: CandidateProfileSidebarProps) => {
  const { t } = useAppTranslation();
  const [documents, setDocuments] = useState<any[]>([]);
  const [education, setEducation] = useState<any[]>([]);
  const [workExperience, setWorkExperience] = useState<any[]>([]);
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [discTestStatus, setDiscTestStatus] = useState<string | null>(null);
  const [photoDisplayUrl, setPhotoDisplayUrl] = useState<string>('');

  useEffect(() => {
    if (candidateData?.id) {
      fetchProgressData();
    }
  }, [candidateData?.id]);

  useEffect(() => {
    let isCancelled = false;

    const resolvePhotoUrl = async () => {
      const raw = (candidateData?.photo_url ?? '').trim();
      if (!raw) {
        if (!isCancelled) setPhotoDisplayUrl('');
        return;
      }

      if (raw.startsWith('http://') || raw.startsWith('https://')) {
        if (!isCancelled) setPhotoDisplayUrl(raw);
        return;
      }

      const signed = await createStorageDisplayUrl('recruitment-files', raw, {
        expiresIn: 60 * 60,
        transform: { width: 128, resize: 'contain', quality: 80 },
      });

      if (!isCancelled) setPhotoDisplayUrl(signed ?? '');
    };

    void resolvePhotoUrl();

    return () => {
      isCancelled = true;
    };
  }, [candidateData?.photo_url]);

  const fetchProgressData = async () => {
    if (!candidateData?.id) return;

    try {
      const [docsResult, eduResult, workResult, familyResult, discResult] = await Promise.all([
        supabase.from('candidate_documents').select('*').eq('candidate_profile_id', candidateData.id),
        supabase.from('candidate_educations').select('*').eq('candidate_profile_id', candidateData.id),
        supabase.from('candidate_work_experiences').select('*').eq('candidate_profile_id', candidateData.id),
        supabase.from('candidate_family_members').select('*').eq('candidate_profile_id', candidateData.id),
        supabase.from('candidate_tests').select('status').eq('candidate_profile_id', candidateData.id).maybeSingle()
      ]);

      setDocuments(docsResult.data || []);
      setEducation(eduResult.data || []);
      setWorkExperience(workResult.data || []);
      setFamilyMembers(familyResult.data || []);
      setDiscTestStatus(discResult.error ? null : ((discResult.data as { status?: string } | null)?.status ?? null));
    } catch (error) {
      console.error('Error fetching progress data:', error);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'CN';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPersonalInfoProgress = () => {
    const requiredFields = [
      candidateData?.full_name,
      candidateData?.email,
      candidateData?.mobile_phone,
      candidateData?.birth_date,
      candidateData?.birth_place,
      candidateData?.gender,
      candidateData?.nik,
      candidateData?.religion,
      candidateData?.marital_status,
      candidateData?.nationality,
      candidateData?.blood_type,
      candidateData?.address,
      candidateData?.citizen_address,
      candidateData?.photo_url
    ];
    const filledFields = requiredFields.filter(field => field && field.toString().trim() !== '').length;
    return Math.round((filledFields / requiredFields.length) * 100);
  };

  const getEducationProgress = () => {
    if (education.length === 0) return 0;
    return 100; // If at least one education entry exists, consider it complete
  };

  const getWorkExperienceProgress = () => {
    if (workExperience.length === 0) return 0;
    return 100; // If at least one work experience entry exists, consider it complete
  };

  const getFamilyMembersProgress = () => {
    const validMembers = familyMembers.filter(member => member.name && member.relationship);
    if (validMembers.length === 0) return 0;
    return 100; // If at least one valid family member exists, consider it complete
  };

  const getDocumentsProgress = () => {
    const requiredDocTypes = ['cv', 'ijazah', 'ktp'];
    const availableDocTypes = documents.map(doc => doc.document_type);
    const completedRequired = requiredDocTypes.filter(type => availableDocTypes.includes(type));
    return Math.round((completedRequired.length / requiredDocTypes.length) * 100);
  };

  const getDiscTestProgress = () => {
    if (discTestStatus === 'submitted') return 100;
    if (discTestStatus === 'in_progress') return 50;
    return 0;
  };

  const getOverallProgress = () => {
    const progressItems = [
      getPersonalInfoProgress(),
      getEducationProgress(),
      getWorkExperienceProgress(),
      getFamilyMembersProgress(),
      getDocumentsProgress(),
      getDiscTestProgress()
    ];
    return Math.round(progressItems.reduce((sum, progress) => sum + progress, 0) / progressItems.length);
  };

  return (
    <div className={cn(
      LAYOUT_CONSTANTS.sidebar.width,
      LAYOUT_CONSTANTS.sidebar.minHeight,
      PROFESSIONAL_COLORS.background.secondary,
      "flex flex-col"
    )}>
      {/* Compact Profile Header */}
      <Card className={cn(
        PROFESSIONAL_COLORS.background.card,
        PROFESSIONAL_COLORS.shadow.sm,
        LAYOUT_CONSTANTS.card.margin
      )}>
        <CardHeader className={cn("text-center", LAYOUT_CONSTANTS.card.paddingSmall, "pb-2")}>
          <Avatar className={cn("h-14 w-14 mx-auto", LAYOUT_CONSTANTS.margin.sm)}>
            <AvatarImage src={photoDisplayUrl || undefined} alt={candidateData?.full_name || 'Candidate'} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
              {getInitials(candidateData?.full_name || '')}
            </AvatarFallback>
          </Avatar>
          <h3 className={cn("text-base font-semibold", PROFESSIONAL_COLORS.text.heading)}>
            {candidateData?.full_name || t('candidateProfile.sidebar.completeName', 'Lengkapi Nama Anda')}
          </h3>
          <Badge className={cn(
            "inline-flex items-center px-2 py-1 text-xs font-medium rounded-full",
            getStatusColor(candidateData?.employment_status || 'pending')
          )}>
            <Briefcase className="h-3 w-3 mr-1" />
            {candidateData?.profile_completed ? t('candidateProfile.sidebar.complete', 'Complete') :
             candidateData?.employment_status === 'pending' ? t('candidateProfile.sidebar.pending', 'Pending') :
             candidateData?.employment_status === 'approved' ? t('candidateProfile.sidebar.approved', 'Approved') :
             candidateData?.employment_status === 'rejected' ? t('candidateProfile.sidebar.rejected', 'Rejected') : t('candidateProfile.sidebar.draft', 'Draft')}
          </Badge>
        </CardHeader>
        <CardContent className={LAYOUT_CONSTANTS.card.paddingSmall}>
          <div className={LAYOUT_CONSTANTS.card.gapSmall}>
            {candidateData?.email && (
              <div className={cn("flex items-center text-sm", PROFESSIONAL_COLORS.text.secondary)}>
                <Mail className="h-4 w-4 mr-3 text-muted-foreground" />
                <span className="truncate">{candidateData.email}</span>
              </div>
            )}
            {candidateData?.mobile_phone && (
              <div className={cn("flex items-center text-sm", PROFESSIONAL_COLORS.text.secondary)}>
                <Phone className="h-4 w-4 mr-3 text-muted-foreground" />
                <span>{candidateData.mobile_phone}</span>
              </div>
            )}
            {candidateData?.birth_date && (
              <div className={cn("flex items-center text-sm", PROFESSIONAL_COLORS.text.secondary)}>
                <Calendar className="h-4 w-4 mr-3 text-muted-foreground" />
                <span>{formatDate(candidateData.birth_date)}</span>
              </div>
            )}
            {candidateData?.address && (
              <div className={cn("flex items-start text-sm", PROFESSIONAL_COLORS.text.secondary)}>
                <MapPin className="h-4 w-4 mr-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                <span className="line-clamp-2">{candidateData.address}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Compact Progress Section */}
      <Card className={cn(
        PROFESSIONAL_COLORS.background.card,
        PROFESSIONAL_COLORS.shadow.sm,
        LAYOUT_CONSTANTS.card.margin
      )}>
        <CardHeader className={LAYOUT_CONSTANTS.card.paddingSmall}>
          <h4 className={cn("text-sm font-medium", PROFESSIONAL_COLORS.text.heading)}>{t('candidateProfile.sidebar.progress', 'Progress')}</h4>
        </CardHeader>
        <CardContent className={LAYOUT_CONSTANTS.card.paddingSmall}>
          <div className={LAYOUT_CONSTANTS.card.gapSmall}>
            <div className="flex items-center justify-between">
              <span className={cn("text-sm", PROFESSIONAL_COLORS.text.secondary)}>{t('candidateProfile.sidebar.personal', 'Personal')}</span>
              <div className="h-1.5 w-14 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn("h-full transition-all duration-300", {
                    'bg-green-500': getPersonalInfoProgress() >= 80,
                    'bg-yellow-500': getPersonalInfoProgress() >= 40 && getPersonalInfoProgress() < 80,
                    'bg-red-500': getPersonalInfoProgress() < 40
                  })}
                  style={{ width: `${getPersonalInfoProgress()}%` }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className={cn("text-sm", PROFESSIONAL_COLORS.text.secondary)}>{t('candidateProfile.sidebar.education', 'Education')}</span>
              <div className="h-1.5 w-14 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn("h-full transition-all duration-300", {
                    'bg-green-500': getEducationProgress() >= 80,
                    'bg-yellow-500': getEducationProgress() >= 40 && getEducationProgress() < 80,
                    'bg-red-500': getEducationProgress() < 40
                  })}
                  style={{ width: `${getEducationProgress()}%` }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className={cn("text-sm", PROFESSIONAL_COLORS.text.secondary)}>{t('candidateProfile.sidebar.experience', 'Experience')}</span>
              <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn("h-full transition-all duration-300", {
                    'bg-green-500': getWorkExperienceProgress() >= 80,
                    'bg-yellow-500': getWorkExperienceProgress() >= 40 && getWorkExperienceProgress() < 80,
                    'bg-red-500': getWorkExperienceProgress() < 40
                  })}
                  style={{ width: `${getWorkExperienceProgress()}%` }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className={cn("text-sm", PROFESSIONAL_COLORS.text.secondary)}>{t('candidateProfile.sidebar.family', 'Family')}</span>
              <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn("h-full transition-all duration-300", {
                    'bg-green-500': getFamilyMembersProgress() >= 80,
                    'bg-yellow-500': getFamilyMembersProgress() >= 40 && getFamilyMembersProgress() < 80,
                    'bg-red-500': getFamilyMembersProgress() < 40
                  })}
                  style={{ width: `${getFamilyMembersProgress()}%` }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className={cn("text-sm", PROFESSIONAL_COLORS.text.secondary)}>{t('candidateProfile.sidebar.documents', 'Documents')}</span>
              <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn("h-full transition-all duration-300", {
                    'bg-green-500': getDocumentsProgress() >= 80,
                    'bg-yellow-500': getDocumentsProgress() >= 40 && getDocumentsProgress() < 80,
                    'bg-red-500': getDocumentsProgress() < 40
                  })}
                  style={{ width: `${getDocumentsProgress()}%` }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className={cn("text-sm", PROFESSIONAL_COLORS.text.secondary)}>{t('candidateProfile.sidebar.test', 'Test')}</span>
              <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn("h-full transition-all duration-300", {
                    'bg-green-500': getDiscTestProgress() >= 80,
                    'bg-yellow-500': getDiscTestProgress() >= 40 && getDiscTestProgress() < 80,
                    'bg-red-500': getDiscTestProgress() < 40
                  })}
                  style={{ width: `${getDiscTestProgress()}%` }}
                />
              </div>
            </div>
          </div>
          
          <div className={cn("mt-4 p-3 bg-primary/10 rounded")}>
            <div className="text-sm text-primary">
              <div className="font-medium">{getOverallProgress()}% {t('candidateProfile.sidebar.percentComplete', 'Complete')}</div>
              <div className="mt-1 text-primary/80 text-sm leading-tight">
                {candidateData?.profile_completed ? t('candidateProfile.sidebar.allDone', 'All done!') : t('candidateProfile.sidebar.completeAllSections', 'Complete all sections')}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compact Help Section */}
      <Card className={cn(
        PROFESSIONAL_COLORS.background.card,
        PROFESSIONAL_COLORS.shadow.sm
      )}>
        <CardHeader className={LAYOUT_CONSTANTS.card.paddingSmall}>
          <h4 className={cn("text-sm font-medium", PROFESSIONAL_COLORS.text.heading)}>{t('candidateProfile.sidebar.help', 'Help')}</h4>
        </CardHeader>
        <CardContent className={LAYOUT_CONSTANTS.card.paddingSmall}>
          <div className={cn("text-sm space-y-2", PROFESSIONAL_COLORS.text.secondary)}>
            <p>{t('candidateProfile.sidebar.helpCompleteSections', 'Complete all sections to submit.')}</p>
            <p>{t('candidateProfile.sidebar.helpUploadDocs', 'Upload CV, Ijazah, KTP.')}</p>
            <p>{t('candidateProfile.sidebar.helpContactHR', 'Contact HR for help.')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
