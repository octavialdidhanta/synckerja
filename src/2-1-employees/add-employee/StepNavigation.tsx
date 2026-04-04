
import { Button } from '@/shared/components/ui/button';
import { ChevronLeft, ChevronRight, UserPlus, Loader2 } from 'lucide-react';

interface StepNavigationProps {
  activeTab: string;
  canProceedPrev: boolean;
  canProceedNext: boolean;
  onPrevStep: () => void;
  onNextStep: () => void;
  onSave: () => void;
  isSubmitting: boolean;
}

export const StepNavigation = ({
  activeTab,
  canProceedPrev,
  canProceedNext,
  onPrevStep,
  onNextStep,
  onSave,
  isSubmitting
}: StepNavigationProps) => {
  const isLastStep = activeTab === 'invite';

  return (
    <div className="flex justify-between items-center pt-6 border-t border-gray-200 mt-8">
      <div>
        {canProceedPrev && (
          <Button 
            variant="outline" 
            onClick={onPrevStep}
            disabled={isSubmitting}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous Step
          </Button>
        )}
      </div>
      
      <div className="flex gap-3">
        {!isLastStep ? (
          <Button 
            onClick={onNextStep} 
            disabled={!canProceedNext || isSubmitting}
            className="flex items-center gap-2"
          >
            Next Step
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button 
            onClick={onSave} 
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating Employee & Sending Invitation...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Save Employee & Send Invitation
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};
