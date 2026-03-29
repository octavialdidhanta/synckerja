import { useState, useRef, useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';
import { PersonalDetailsTab } from './PersonalDetailsTab';
import { AddressApplicationTab } from './AddressApplicationTab';
import { DocumentsTab } from './DocumentsTab';
import { EducationTab } from './EducationTab';
import { InformalEducationTab } from './InformalEducationTab';
import { WorkExperienceTab } from './WorkExperienceTab';
import { FamilyMembersTab } from './FamilyMembersTab';
import { ChevronLeft, ChevronRight, Check, Loader2, PartyPopper, AlertCircle } from 'lucide-react';
import { useToast } from '@/shared/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { 
  validatePersonalDetails, 
  validateAddress, 
  validateDocuments, 
  validateEducation, 
  validateWorkExperience, 
  validateFamilyMembers,
  ValidationResult 
} from './utils/stepValidation';

interface CandidateProfileWizardProps {
  candidate: any;
  onUpdate: (data: any) => void;
  onFinalSubmit: () => void;
  isReadOnly?: boolean;
  submitting?: boolean;
}

const tabs = [
  { id: 'personal', label: 'Personal Info', component: PersonalDetailsTab },
  { id: 'address', label: 'Address Info', component: AddressApplicationTab },
  { id: 'documents', label: 'Documents', component: DocumentsTab },
  { id: 'education', label: 'Education', component: EducationTab },
  { id: 'informal-education', label: 'Informal Education', component: InformalEducationTab },
  { id: 'experience', label: 'Experience', component: WorkExperienceTab },
  { id: 'family', label: 'Family', component: FamilyMembersTab }
];

export const CandidateProfileWizard = ({ 
  candidate, 
  onUpdate, 
  onFinalSubmit,
  isReadOnly = false,
  submitting = false
}: CandidateProfileWizardProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [stepValidation, setStepValidation] = useState<Record<number, ValidationResult>>({});
  const { toast } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (candidate?.id) {
      validateCurrentStep();
    }
  }, [candidate?.id, currentStep]);

  const validateCurrentStep = async () => {
    if (!candidate?.id || isReadOnly) return;
    
    setValidating(true);
    setValidationError(null);
    
    try {
      let validation: ValidationResult;
      
      switch (currentStep) {
        case 0: // Personal Info
          validation = validatePersonalDetails(candidate);
          break;
        case 1: // Address
          validation = validateAddress(candidate);
          break;
        case 2: // Documents
          validation = await validateDocuments(candidate.id);
          break;
        case 3: // Education
          validation = await validateEducation(candidate.id);
          break;
        case 4: // Informal Education (optional)
          validation = { isValid: true, missingFields: [], message: 'Data pendidikan informal opsional' };
          break;
        case 5: // Work Experience
          validation = await validateWorkExperience(candidate.id);
          break;
        case 6: // Family
          validation = await validateFamilyMembers(candidate.id);
          break;
        default:
          validation = { isValid: true, missingFields: [], message: 'Validasi berhasil' };
      }
      
      setStepValidation(prev => ({
        ...prev,
        [currentStep]: validation
      }));
      
      if (!validation.isValid && validation.message) {
        setValidationError(validation.message);
      }
    } catch (error) {
      console.error('Validation error:', error);
      setValidationError('Terjadi kesalahan saat memvalidasi data');
    } finally {
      setValidating(false);
    }
  };

  const scrollToTop = () => {
    if (contentRef.current) {
      contentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNext = async () => {
    const currentValidation = stepValidation[currentStep];
    
    if (!currentValidation?.isValid) {
      if (currentValidation?.message) {
        toast({
          title: "Data Belum Lengkap",
          description: currentValidation.message,
          variant: "destructive"
        });
      }
      return;
    }
    
    if (currentStep < tabs.length - 1) {
      setCurrentStep(currentStep + 1);
      scrollToTop();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      scrollToTop();
    }
  };

  const handleFinalSubmit = async () => {
    // Validate all steps before final submit
    setValidating(true);
    
    try {
      const validations = await Promise.all([
        Promise.resolve(validatePersonalDetails(candidate)),
        Promise.resolve(validateAddress(candidate)),
        validateDocuments(candidate.id),
        validateEducation(candidate.id),
        Promise.resolve({ isValid: true, missingFields: [], message: 'Data pendidikan informal opsional' }), // Informal education is optional
        validateWorkExperience(candidate.id),
        validateFamilyMembers(candidate.id)
      ]);
      
      const invalidSteps = validations
        .map((validation, index) => ({ validation, index }))
        .filter(({ validation }) => !validation.isValid);
      
      if (invalidSteps.length > 0) {
        const firstInvalidStep = invalidSteps[0];
        setCurrentStep(firstInvalidStep.index);
        toast({
          title: "Data Belum Lengkap",
          description: firstInvalidStep.validation.message || "Mohon lengkapi data yang diperlukan",
          variant: "destructive"
        });
        return;
      }
      
      await onFinalSubmit();
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Final validation error:', error);
      toast({
        title: "Error",
        description: "Gagal submit profile. Silakan coba lagi.",
        variant: "destructive"
      });
    } finally {
      setValidating(false);
    }
  };

  const CurrentTabComponent = tabs[currentStep].component as any;
  const isLastStep = currentStep === tabs.length - 1;
  const currentValidation = stepValidation[currentStep];
  const canProceedNext = currentValidation?.isValid ?? false;

  return (
    <div className="w-full space-y-8" ref={contentRef}>
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {tabs.map((tab, index) => (
            <div
              key={tab.id}
              className={`flex items-center ${
                index < tabs.length - 1 ? 'flex-1' : ''
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  index < currentStep
                    ? 'bg-green-600 text-white'
                    : index === currentStep
                    ? stepValidation[index]?.isValid
                      ? 'bg-green-600 text-white'
                      : 'bg-yellow-500 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {index < currentStep || stepValidation[index]?.isValid ? (
                  <Check className="h-4 w-4" />
                ) : index === currentStep && validating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  index + 1
                )}
              </div>
              <div className="ml-2 hidden sm:block">
                <p className={`text-sm font-medium ${
                  index <= currentStep ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {tab.label}
                </p>
              </div>
              {index < tabs.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-4 ${
                    index < currentStep ? 'bg-green-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Validation Alert */}
      {validationError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}

      {/* Current Step Content */}
      <div className="min-h-[400px]">
        {currentStep === 3 ? (
          <CurrentTabComponent
            candidate={candidate}
            onUpdate={onUpdate}
            isReadOnly={isReadOnly}
            candidateProfileId={candidate?.id}
            onDocumentsChange={validateCurrentStep}
            onEducationChange={validateCurrentStep}
          />
        ) : (
          <CurrentTabComponent
            candidate={candidate}
            onUpdate={onUpdate}
            isReadOnly={isReadOnly}
            candidateProfileId={candidate?.id}
            onDocumentsChange={validateCurrentStep}
          />
        )}
      </div>

      {/* Navigation Buttons - Fixed positioned */}
      {!isReadOnly && (
        <div className="sticky bottom-0 bg-white border-t shadow-lg p-4 z-10">
          <div className="flex justify-between items-center max-w-7xl mx-auto">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            {isLastStep ? (
              <Button
                type="button"
                onClick={handleFinalSubmit}
                disabled={submitting || validating || !canProceedNext}
                className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
              >
                {submitting || validating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {submitting ? 'Submitting...' : 'Validating...'}
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Submit Profile
                  </>
                )}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleNext}
                disabled={validating || !canProceedNext}
                className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
              >
                {validating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2 text-green-600">
              <PartyPopper className="h-6 w-6" />
              Congratulations!
            </DialogTitle>
          </DialogHeader>
          <Card>
            <CardContent className="p-6 text-center space-y-4">
              <div className="text-6xl">🎉</div>
              <h3 className="text-xl font-semibold text-gray-900">
                Profile Successfully Submitted!
              </h3>
              <p className="text-gray-600">
                Thank you for completing your profile. HR will review your information and contact you soon.
              </p>
              <Button 
                onClick={() => setShowSuccessModal(false)}
                className="w-full"
              >
                Close
              </Button>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    </div>
  );
};
