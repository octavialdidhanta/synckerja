
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { PersonalDetailsTab } from './PersonalDetailsTab';
import { AddressApplicationTab } from './AddressApplicationTab';
import { DocumentsTabNew } from './DocumentsTabNew';
import { EducationTab } from './EducationTab';
import { InformalEducationTab } from './InformalEducationTab';
import { WorkExperienceTab } from './WorkExperienceTab';
import { FamilyMembersTab } from './FamilyMembersTab';
import { TestTabWrapper } from './TestTabWrapper';
import { CandidateReviewsTab } from './CandidateReviewsTab';
import { User, MapPin, FileText, GraduationCap, Award, Briefcase, Users, ClipboardList, Star, ChevronRight, CheckCircle2, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/shared/components/ui/dialog';
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
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/components/ui/use-toast';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

// Layout constants - COMPACT VERSION
const LAYOUT_CONSTANTS = {
  padding: {
    md: 'p-3'
  }
};

// Professional colors
const PROFESSIONAL_COLORS = {
  background: {
    primary: 'bg-white',
    secondary: 'bg-gray-50'
  },
  text: {
    heading: 'text-gray-900',
    secondary: 'text-gray-600'
  },
  border: {
    default: 'border-gray-200',
    muted: 'border-gray-100'
  },
  shadow: {
    sm: 'shadow-sm'
  }
};

interface CandidateProfileTabsProps {
  candidate: any;
  onUpdate: (data: any) => void;
  isReadOnly?: boolean;
  hideReviews?: boolean;
  onStepValidation?: (stepId: string, isValid: boolean) => void;
  onFinalSubmit?: () => void;
  isHRView?: boolean; // For HR/admin view - hide submit button
}

export const CandidateProfileTabs = ({ 
  candidate, 
  onUpdate, 
  isReadOnly = false,
  hideReviews = false,
  onStepValidation,
  onFinalSubmit,
  isHRView = false
}: CandidateProfileTabsProps) => {
  const [activeTab, setActiveTab] = useState('personal');
  const [stepValidations, setStepValidations] = useState<Record<string, boolean>>({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { t } = useAppTranslation();
  
  // Use ref to store onStepValidation callback to prevent infinite loops
  const onStepValidationRef = useRef(onStepValidation);
  useEffect(() => {
    onStepValidationRef.current = onStepValidation;
  }, [onStepValidation]);

  // Memoize tabs array to prevent recreation on every render (labels use i18n from settings)
  const tabs = useMemo(() => {
    const baseTabs = [
      {
        id: 'personal',
        label: t('candidateProfile.tabs.personal', 'Personal Info'),
        icon: User,
        component: PersonalDetailsTab,
        stepNumber: 1,
        requiredFields: ['full_name', 'email', 'mobile_phone', 'birth_date', 'birth_place', 'gender', 'nik', 'religion', 'marital_status', 'nationality', 'blood_type']
      },
      {
        id: 'address',
        label: t('candidateProfile.tabs.address', 'Address'),
        icon: MapPin,
        component: AddressApplicationTab,
        stepNumber: 2,
        requiredFields: ['address', 'citizen_address', 'postal_code']
      },
      {
        id: 'documents',
        label: t('candidateProfile.tabs.documents', 'Documents'),
        icon: FileText,
        component: DocumentsTabNew,
        stepNumber: 3,
        requiredFields: ['cv_file_path'] // At least CV should be uploaded
      },
      {
        id: 'education',
        label: t('candidateProfile.tabs.education', 'Education'),
        icon: GraduationCap,
        component: EducationTab,
        stepNumber: 4,
        requiredFields: [] // At least one education entry
      },
      {
        id: 'informal-education',
        label: t('candidateProfile.tabs.informalEducation', 'Informal Education'),
        icon: Award,
        component: InformalEducationTab,
        stepNumber: 5,
        requiredFields: [] // Optional
      },
      {
        id: 'experience',
        label: t('candidateProfile.tabs.experience', 'Experience'),
        icon: Briefcase,
        component: WorkExperienceTab,
        stepNumber: 6,
        requiredFields: [] // At least one work experience entry
      },
      {
        id: 'family',
        label: t('candidateProfile.tabs.family', 'Family'),
        icon: Users,
        component: FamilyMembersTab,
        stepNumber: 7,
        requiredFields: [] // Optional but recommended
      },
      {
        id: 'test',
        label: t('candidateProfile.tabs.test', 'Test'),
        icon: ClipboardList,
        component: TestTabWrapper,
        stepNumber: 8,
        requiredFields: [] // Validated via hasDiscCompleted
      }
    ];

    // Reviews tab is for HRD only - shown when hideReviews is false (HR view)
    if (!hideReviews) {
      baseTabs.push({
        id: 'reviews',
        label: t('candidateProfile.tabs.reviews', 'Reviews'),
        icon: Star,
        component: CandidateReviewsTab,
        stepNumber: 9,
        requiredFields: []
      });
    }

    return baseTabs;
  }, [hideReviews, t]);

  // State for education, experience, family, and DISC validation
  const [hasEducation, setHasEducation] = useState(false);
  const [hasExperience, setHasExperience] = useState(false);
  const [requiredDocumentsUploaded, setRequiredDocumentsUploaded] = useState(false);
  const [hasFamilyMember, setHasFamilyMember] = useState(false);
  const [hasDiscCompleted, setHasDiscCompleted] = useState(false);
  const [hasCognitiveCompleted, setHasCognitiveCompleted] = useState(false);
  const [hasSjtCompleted, setHasSjtCompleted] = useState(false);

  // Check education, experience, documents, family, DISC test, Cognitive test, and SJT
  useEffect(() => {
    if (!candidate?.id) return;

    const checkData = async () => {
      try {
        const [eduResult, expResult, docsResult, familyResult, testsMetaResult, candidateTestsResult] = await Promise.all([
          supabase
            .from('candidate_educations')
            .select('id')
            .eq('candidate_profile_id', candidate.id)
            .limit(1),
          supabase
            .from('candidate_work_experiences')
            .select('id')
            .eq('candidate_profile_id', candidate.id)
            .limit(1),
          supabase
            .from('candidate_documents')
            .select('document_type')
            .eq('candidate_profile_id', candidate.id),
          supabase
            .from('candidate_family_members')
            .select('id')
            .eq('candidate_profile_id', candidate.id)
            .limit(1),
          supabase
            .from('tests')
            .select('id, type')
            .in('type', ['disc', 'cognitive', 'sjt'])
            .eq('is_active', true),
          supabase
            .from('candidate_tests')
            .select('test_id')
            .eq('candidate_profile_id', candidate.id)
            .eq('status', 'submitted')
        ]);

        setHasEducation((eduResult.data?.length || 0) > 0);
        setHasExperience((expResult.data?.length || 0) > 0);
        setHasFamilyMember((familyResult.data?.length || 0) > 0);

        const testIds = (testsMetaResult.data || []) as { id: string; type: string }[];
        const discTestId = testIds.find(t => t.type === 'disc')?.id;
        const cognitiveTestId = testIds.find(t => t.type === 'cognitive')?.id;
        const sjtTestId = testIds.find(t => t.type === 'sjt')?.id;
        const submittedTestIds = (candidateTestsResult.data || []).map((r: { test_id: string }) => r.test_id);
        setHasDiscCompleted(!!discTestId && submittedTestIds.includes(discTestId));
        setHasCognitiveCompleted(!!cognitiveTestId && submittedTestIds.includes(cognitiveTestId));
        setHasSjtCompleted(!!sjtTestId && submittedTestIds.includes(sjtTestId));

        // Check if all required documents are uploaded (CV, KTP, Ijazah)
        const requiredDocTypes = ['cv', 'ktp', 'ijazah'];
        const uploadedDocTypes = (docsResult.data || []).map((doc: any) => doc.document_type || '');
        const allRequiredUploaded = requiredDocTypes.every(type => uploadedDocTypes.includes(type));
        setRequiredDocumentsUploaded(allRequiredUploaded);
      } catch (error) {
        console.error('Error checking data:', error);
      }
    };

    checkData();
  }, [candidate?.id]);

  // Validate step based on candidate data
  const validateStep = useCallback((stepId: string, requiredFields: string[]) => {
    if (!candidate) return false;
    
    if (stepId === 'personal') {
      return requiredFields.every(field => {
        const value = candidate[field];
        return value && value.toString().trim() !== '';
      });
    }
    
    if (stepId === 'address') {
      return requiredFields.every(field => {
        const value = candidate[field];
        return value && value.toString().trim() !== '';
      });
    }
    
    if (stepId === 'documents') {
      // Check if all required documents are uploaded (CV, KTP, Ijazah)
      return requiredDocumentsUploaded;
    }
    
    if (stepId === 'education') {
      // Check if at least one education entry exists
      return hasEducation;
    }
    
    if (stepId === 'experience') {
      // Check if at least one work experience entry exists
      return hasExperience;
    }
    
    if (stepId === 'family') {
      // Check if at least one family member exists
      return hasFamilyMember;
    }

    if (stepId === 'test') {
      return hasDiscCompleted && hasCognitiveCompleted && hasSjtCompleted;
    }

    // Other steps are optional
    return true;
  }, [candidate, hasEducation, hasExperience, requiredDocumentsUploaded, hasFamilyMember, hasDiscCompleted, hasCognitiveCompleted, hasSjtCompleted]);

  // Check if current step is valid
  const currentStepIndex = tabs.findIndex(tab => tab.id === activeTab);
  const currentTab = tabs[currentStepIndex];
  const isCurrentStepValid = currentTab ? validateStep(currentTab.id, currentTab.requiredFields || []) : false;
  const isLastStep = currentStepIndex === tabs.length - 1;
  
  // Debug logging removed to prevent infinite loop

  // Handle next step
  const handleNext = useCallback(() => {
    if (currentStepIndex < tabs.length - 1) {
      const nextTab = tabs[currentStepIndex + 1];
      setActiveTab(nextTab.id);
    }
  }, [currentStepIndex, tabs]);

  // Handle final submit (called after user confirms in dialog)
  const handleSubmit = useCallback(async () => {
    if (!candidate?.id) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('candidate_profiles').update({
        profile_completed: true,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', candidate.id);

      if (error) throw error;

      const tokenFromUrl = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token')?.trim() : '';
      const recruitmentToken = candidate.recruitment_token?.trim() || tokenFromUrl;
      if (recruitmentToken) {
        const { error: appError } = await supabase
          .from('job_applications')
          .update({ status: 'confirmed' })
          .eq('recruitment_token', recruitmentToken);
        if (appError) {
          console.error('Error updating job_applications status to confirmed:', appError);
          toast({
            title: "Peringatan",
            description: "Profil tersimpan, tetapi status lamaran tidak terupdate. Silakan hubungi HR.",
            variant: "destructive"
          });
        }
      }

      onUpdate({
        ...candidate,
        profile_completed: true,
        submitted_at: new Date().toISOString()
      });

      setShowConfirmDialog(false);
      if (!onFinalSubmit) {
        setShowSuccessModal(true);
      }
      if (onFinalSubmit) {
        onFinalSubmit();
      }
    } catch (error) {
      console.error('Error submitting profile:', error);
      toast({
        title: "Error",
        description: "Gagal submit profile. Silakan coba lagi.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [candidate, toast, onFinalSubmit, onUpdate]);

  // Update step validation when candidate data changes
  useEffect(() => {
    // Only validate if candidate exists
    if (!candidate?.id) return;
    
    // Validate all tabs
    const newValidations: Record<string, boolean> = {};
    tabs.forEach(tab => {
      const isValid = validateStep(tab.id, tab.requiredFields || []);
      newValidations[tab.id] = isValid;
    });
    
    // Update all validations at once to avoid multiple re-renders
    setStepValidations(newValidations);
    
    // Call onStepValidation callback after state update (using ref to prevent infinite loop)
    if (onStepValidationRef.current) {
      tabs.forEach(tab => {
        onStepValidationRef.current?.(tab.id, newValidations[tab.id] || false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate?.id, validateStep, hasEducation, hasExperience, requiredDocumentsUploaded, hasFamilyMember, hasDiscCompleted]);

  // Simplified tab change handler - only allow if previous steps are valid
  const handleTabChange = useCallback((tabId: string) => {
    const targetIndex = tabs.findIndex(tab => tab.id === tabId);
    const currentIndex = tabs.findIndex(tab => tab.id === activeTab);
    
    // Allow going back or to current step
    if (targetIndex <= currentIndex) {
      setActiveTab(tabId);
      return;
    }
    
    // Check if all previous steps are valid before allowing forward navigation
    let canNavigate = true;
    for (let i = 0; i < targetIndex; i++) {
      const tab = tabs[i];
      // Validate step using validateStep function which handles all cases including experience and family
      const isValid = validateStep(tab.id, tab.requiredFields || []);
      if (!isValid) {
        canNavigate = false;
        break;
      }
    }
    
    if (canNavigate) {
      setActiveTab(tabId);
    } else {
      // Find which step is blocking navigation
      const blockingStep = tabs.find((tab, index) => {
        if (index < targetIndex) {
          return !validateStep(tab.id, tab.requiredFields || []);
        }
        return false;
      });
      
      let errorMessage = "Silakan lengkapi semua field yang wajib diisi pada step sebelumnya.";
      if (blockingStep) {
        if (blockingStep.id === 'experience') {
          errorMessage = "Silakan tambahkan minimal 1 pengalaman kerja sebelum melanjutkan ke step berikutnya.";
        } else if (blockingStep.id === 'family') {
          errorMessage = "Silakan tambahkan minimal 1 anggota keluarga sebelum submit.";
        } else if (blockingStep.id === 'test') {
          errorMessage = "Silakan selesaikan Tes DISC, Test Kognitif, dan Tes Situasi Kerja sebelum submit profil.";
        } else if (blockingStep.id === 'documents') {
          errorMessage = "Silakan upload semua dokumen wajib (CV, KTP, Ijazah) sebelum melanjutkan.";
        } else if (blockingStep.id === 'education') {
          errorMessage = "Silakan tambahkan minimal 1 pendidikan sebelum melanjutkan ke step berikutnya.";
        } else if (blockingStep.id === 'personal') {
          errorMessage = "Silakan lengkapi semua informasi personal yang wajib diisi.";
        } else if (blockingStep.id === 'address') {
          errorMessage = "Silakan lengkapi semua informasi alamat yang wajib diisi.";
        }
      }
      
      toast({
        title: "Lengkapi step sebelumnya",
        description: errorMessage,
        variant: "destructive"
      });
    }
  }, [activeTab, tabs, validateStep, toast]);

  return (
    <>
    <div className="w-full h-full">
      <Tabs 
        value={activeTab} 
        onValueChange={handleTabChange} 
        className="w-full h-full flex flex-col"
        onKeyDown={(e) => {
          // Prevent keyboard navigation on Tabs component
          if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        {/* Compact Tab Navigation - scrollable so first/last tabs are fully visible */}
        <div className={cn(
          PROFESSIONAL_COLORS.background.secondary,
          PROFESSIONAL_COLORS.border.default,
          "border-b px-4 py-3 flex-shrink-0 overflow-x-auto overflow-y-hidden"
        )}>
          <TabsList className={cn(
            "flex w-max min-w-full gap-1 h-auto p-1 rounded-md flex-shrink-0",
            PROFESSIONAL_COLORS.background.primary,
            PROFESSIONAL_COLORS.border.muted,
            "border"
          )}>
            {tabs.map((tab, index) => {
              const IconComponent = tab.icon;
              const isCompleted = stepValidations[tab.id] || false;
              const isActive = tab.id === activeTab;
              
              // Check if this tab can be accessed (all previous steps must be valid)
              const tabIndex = tabs.findIndex(t => t.id === tab.id);
              // Reviews tab is always accessible for HR view (no validation needed)
              const isReviewsTab = tab.id === 'reviews';
              // Allow access if:
              // 1. It's the Reviews tab (always accessible for HR)
              // 2. Tab is before or equal to current step (can go back)
              // 3. All previous tabs are valid (can go forward)
              const canAccessTab = isReviewsTab || tabIndex <= currentStepIndex || 
                tabs.slice(0, tabIndex).every(t => {
                  const isValid = validateStep(t.id, t.requiredFields || []);
                  return isValid;
                });
              
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  tabIndex={-1}
                  disabled={!canAccessTab}
                  onClick={(e) => {
                    // Reviews tab is always accessible - skip validation
                    if (isReviewsTab) {
                      return;
                    }
                    // Prevent click if tab is not accessible
                    if (!canAccessTab) {
                      e.preventDefault();
                      e.stopPropagation();
                      // Find which step is blocking
                      const blockingStep = tabs.find((t, idx) => {
                        if (idx < tabIndex) {
                          return !validateStep(t.id, t.requiredFields || []);
                        }
                        return false;
                      });
                      
                      let errorMessage = "Silakan lengkapi semua field yang wajib diisi pada step sebelumnya.";
                      if (blockingStep) {
                        if (blockingStep.id === 'experience') {
                          errorMessage = "Silakan tambahkan minimal 1 pengalaman kerja sebelum melanjutkan ke step berikutnya.";
                        } else if (blockingStep.id === 'documents') {
                          errorMessage = "Silakan upload semua dokumen wajib (CV, KTP, Ijazah) sebelum melanjutkan.";
                        } else if (blockingStep.id === 'education') {
                          errorMessage = "Silakan tambahkan minimal 1 pendidikan sebelum melanjutkan ke step berikutnya.";
                        } else if (blockingStep.id === 'personal') {
                          errorMessage = "Silakan lengkapi semua informasi personal yang wajib diisi.";
                        } else if (blockingStep.id === 'address') {
                          errorMessage = "Silakan lengkapi semua informasi alamat yang wajib diisi.";
                        }
                      }
                      
                      toast({
                        title: "Lengkapi step sebelumnya",
                        description: errorMessage,
                        variant: "destructive"
                      });
                      return;
                    }
                  }}
                  onKeyDown={(e) => {
                    // Prevent keyboard navigation (Arrow keys, Enter, Space, Tab)
                    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' ', 'Tab'].includes(e.key)) {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded transition-all relative",
                    "text-sm min-w-0 flex-shrink-0 whitespace-nowrap",
                    "data-[state=active]:bg-card data-[state=active]:text-card-foreground",
                    "data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground",
                    "hover:text-foreground",
                    "focus-visible:outline-none focus-visible:ring-0", // Remove focus ring
                    !canAccessTab && !isReviewsTab && "opacity-50 cursor-not-allowed pointer-events-none" // Disable styling for inaccessible tabs (except Reviews)
                  )}
                >
                  <IconComponent className="h-4 w-4 flex-shrink-0" />
                  <span className="hidden sm:block truncate font-medium">{tab.label}</span>
                  {/* Step indicator badge on tab - show checkmark if completed */}
                  {isCompleted && !isActive && (
                    <CheckCircle2 className="h-4 w-4 text-green-500 ml-1 flex-shrink-0" />
                  )}
                  {/* Active tab indicator */}
                  {isActive && (
                    <div className="absolute -bottom-1 left-0 right-0 h-1 bg-blue-600 rounded-t" />
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* Compact Tab Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {tabs.map((tab) => {
            const TabComponent = tab.component;
            return (
              <TabsContent 
                key={tab.id} 
                value={tab.id} 
                className="h-full overflow-hidden data-[state=active]:flex data-[state=active]:flex-col m-0 flex-1"
              >
                <div className={cn(
                  "flex-1 overflow-auto flex flex-col",
                  LAYOUT_CONSTANTS.padding.md
                )}>
                  <TabComponent
                    {...(tab.id === 'education' && {
                      onEducationChange: async () => {
                        // Re-check education when education changes
                        if (candidate?.id) {
                          try {
                            const { data: eduData } = await supabase
                              .from('candidate_educations')
                              .select('id')
                              .eq('candidate_profile_id', candidate.id)
                              .limit(1);
                            const hasEdu = (eduData?.length || 0) > 0;
                            setHasEducation(hasEdu);
                          } catch (error) {
                            console.error('Error re-checking education:', error);
                          }
                        }
                      }
                    })}
                    {...(tab.id === 'documents' && {
                      onDocumentsChange: async () => {
                        // Re-check required documents when documents change
                        if (candidate?.id) {
                          try {
                            const { data: docsData } = await supabase
                              .from('candidate_documents')
                              .select('document_type')
                              .eq('candidate_profile_id', candidate.id);
                            const requiredDocTypes = ['cv', 'ktp', 'ijazah'];
                            const uploadedDocTypes = (docsData || []).map((doc: any) => doc.document_type || '');
                            const allRequiredUploaded = requiredDocTypes.every(type => uploadedDocTypes.includes(type));
                            setRequiredDocumentsUploaded(allRequiredUploaded);
                          } catch (error) {
                            console.error('Error re-checking documents:', error);
                          }
                        }
                      }
                    })}
                    {...(tab.id === 'family' && {
                      onFamilyMembersChange: async () => {
                        // Re-check family members when family members change
                        if (candidate?.id) {
                          try {
                            const { data: familyData } = await supabase
                              .from('candidate_family_members')
                              .select('id')
                              .eq('candidate_profile_id', candidate.id)
                              .limit(1);
                            const hasFamily = (familyData?.length || 0) > 0;
                            setHasFamilyMember(hasFamily);
                          } catch (error) {
                            console.error('Error re-checking family members:', error);
                          }
                        }
                      }
                    })}
                    {...(tab.id === 'test' && {
                      candidateProfileId: candidate?.id ?? '',
                      recruitmentToken: (candidate?.recruitment_token ?? typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') ?? '' : '') as string,
                      hasDiscCompleted,
                      hasCognitiveCompleted,
                      onTestCompleted: async () => {
                        if (candidate?.id) {
                          try {
                            const { data: testsMeta } = await supabase.from('tests').select('id, type').in('type', ['disc', 'cognitive', 'sjt']).eq('is_active', true);
                            const testIds = (testsMeta || []) as { id: string; type: string }[];
                            const discTestId = testIds.find(t => t.type === 'disc')?.id;
                            const cognitiveTestId = testIds.find(t => t.type === 'cognitive')?.id;
                            const sjtTestId = testIds.find(t => t.type === 'sjt')?.id;
                            const { data: ctData } = await supabase
                              .from('candidate_tests')
                              .select('test_id')
                              .eq('candidate_profile_id', candidate.id)
                              .eq('status', 'submitted');
                            const submittedTestIds = (ctData || []).map((r: { test_id: string }) => r.test_id);
                            setHasDiscCompleted(!!discTestId && submittedTestIds.includes(discTestId));
                            setHasCognitiveCompleted(!!cognitiveTestId && submittedTestIds.includes(cognitiveTestId));
                            setHasSjtCompleted(!!sjtTestId && submittedTestIds.includes(sjtTestId));
                          } catch (error) {
                            console.error('Error re-checking tests:', error);
                          }
                        }
                      }
                    })}
                    {...(tab.id === 'experience' && {
                      onWorkExperienceChange: async () => {
                        // Re-check work experiences when work experiences change
                        if (candidate?.id) {
                          try {
                            const { data: expData } = await supabase
                              .from('candidate_work_experiences')
                              .select('id')
                              .eq('candidate_profile_id', candidate.id)
                              .limit(1);
                            const hasExp = (expData?.length || 0) > 0;
                            setHasExperience(hasExp);
                          } catch (error) {
                            console.error('Error re-checking work experience:', error);
                          }
                        }
                      }
                    })}
                    candidate={candidate}
                    onUpdate={(data) => {
                      onUpdate(data);
                      // Trigger re-validation after update
                      setTimeout(() => {
                        if (candidate?.id) {
                          const checkData = async () => {
                            try {
                              if (tab.id === 'education') {
                                const { data: eduData } = await supabase
                                  .from('candidate_educations')
                                  .select('id')
                                  .eq('candidate_profile_id', candidate.id)
                                  .limit(1);
                                setHasEducation((eduData?.length || 0) > 0);
                              } else if (tab.id === 'experience') {
                                const { data: expData } = await supabase
                                  .from('candidate_work_experiences')
                                  .select('id')
                                  .eq('candidate_profile_id', candidate.id)
                                  .limit(1);
                                setHasExperience((expData?.length || 0) > 0);
                              } else if (tab.id === 'documents') {
                                // Re-check required documents
                                const { data: docsData } = await supabase
                                  .from('candidate_documents')
                                  .select('document_type')
                                  .eq('candidate_profile_id', candidate.id);
                                const requiredDocTypes = ['cv', 'ktp', 'ijazah'];
                                const uploadedDocTypes = (docsData || []).map((doc: any) => doc.document_type);
                                const allRequiredUploaded = requiredDocTypes.every(type => uploadedDocTypes.includes(type));
                                setRequiredDocumentsUploaded(allRequiredUploaded);
                              } else if (tab.id === 'family') {
                                // Re-check family members
                                const { data: familyData } = await supabase
                                  .from('candidate_family_members')
                                  .select('id')
                                  .eq('candidate_profile_id', candidate.id)
                                  .limit(1);
                                setHasFamilyMember((familyData?.length || 0) > 0);
                              } else if (tab.id === 'test') {
                                const { data: testsMeta } = await supabase.from('tests').select('id, type').in('type', ['disc', 'cognitive', 'sjt']).eq('is_active', true);
                                const testIds = (testsMeta || []) as { id: string; type: string }[];
                                const discTestId = testIds.find(t => t.type === 'disc')?.id;
                                const cognitiveTestId = testIds.find(t => t.type === 'cognitive')?.id;
                                const sjtTestId = testIds.find(t => t.type === 'sjt')?.id;
                                const { data: ctData } = await supabase
                                  .from('candidate_tests')
                                  .select('test_id')
                                  .eq('candidate_profile_id', candidate.id)
                                  .eq('status', 'submitted');
                                const submittedTestIds = (ctData || []).map((r: { test_id: string }) => r.test_id);
                                setHasDiscCompleted(!!discTestId && submittedTestIds.includes(discTestId));
                                setHasCognitiveCompleted(!!cognitiveTestId && submittedTestIds.includes(cognitiveTestId));
                                setHasSjtCompleted(!!sjtTestId && submittedTestIds.includes(sjtTestId));
                              }
                            } catch (error) {
                              console.error('Error re-checking data:', error);
                            }
                          };
                          checkData();
                        }
                      }, 500);
                    }}
                    isReadOnly={isReadOnly}
                    candidateProfileId={candidate?.id}
                    isHRView={tab.id === 'test' ? isHRView : undefined}
                  />
                  
                  {/* Navigation Buttons - Submit only on Test tab (and only if not HR view) */}
                  {!isHRView && (
                    <>
                      {tab.id === 'test' ? (
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 flex-shrink-0">
                          <div className="flex items-center gap-2">
                            {currentStepIndex > 0 && (
                              <Button
                                variant="outline"
                                onClick={() => {
                                  const prevTab = tabs[currentStepIndex - 1];
                                  setActiveTab(prevTab.id);
                                }}
                                className="flex items-center gap-2"
                              >
                                {t('candidateProfile.buttons.previous', 'Previous')}
                              </Button>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => setShowConfirmDialog(true)}
                              disabled={!isCurrentStepValid || isSubmitting || !!candidate?.profile_completed}
                              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {t('candidateProfile.buttons.submitProfile', 'Submit Profile')}
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 flex-shrink-0">
                          <div className="flex items-center gap-2">
                            {currentStepIndex > 0 && (
                              <Button
                                variant="outline"
                                onClick={() => {
                                  const prevTab = tabs[currentStepIndex - 1];
                                  setActiveTab(prevTab.id);
                                }}
                                className="flex items-center gap-2"
                              >
                                {t('candidateProfile.buttons.previous', 'Previous')}
                              </Button>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={handleNext}
                              disabled={!isCurrentStepValid}
                              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {t('candidateProfile.buttons.next', 'Next')}
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </TabsContent>
            );
          })}
        </div>
      </Tabs>
    </div>

    <AlertDialog open={showConfirmDialog} onOpenChange={(open) => !isSubmitting && setShowConfirmDialog(open)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('candidateProfile.submitConfirm.title', 'Yakin kirim profil?')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('candidateProfile.submitConfirm.description', 'Pastikan semua data (informasi pribadi, alamat, dokumen, pendidikan, pengalaman, keluarga, dan Tes DISC) sudah benar. Setelah submit, data tidak dapat diubah lagi.')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>
            {t('candidateProfile.submitConfirm.reviewAgain', 'Periksa lagi')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
            disabled={isSubmitting}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('candidateProfile.submitConfirm.submitting', 'Mengirim...')}
              </>
            ) : (
              t('candidateProfile.submitConfirm.yesSubmit', 'Ya, submit')
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
      <DialogContent className="sm:max-w-md">
        <div className="text-center py-4">
          <CheckCircle className="h-14 w-14 text-green-500 mx-auto mb-3" />
          <DialogTitle className="text-xl font-semibold text-gray-900 mb-2">
            {t('candidateProfile.successModal.title', 'Congratulations!')}
          </DialogTitle>
          <p className="text-gray-600 text-sm mb-6">
            {t('candidateProfile.successModal.message', 'Your profile has been submitted successfully.')}
          </p>
          <Button onClick={() => setShowSuccessModal(false)} className="min-w-[120px]">
            {t('candidateProfile.buttons.ok', 'OK')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};
