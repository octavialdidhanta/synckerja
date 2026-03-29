
import { useState } from 'react';
import { TabStep, StepNavigation, ValidationSchema } from '@/types/steps';
import { EmployeeFormData } from '@/types/forms';

export const useStepNavigation = (
  validationSchema: ValidationSchema,
  formData: EmployeeFormData
): StepNavigation => {
  const [activeTab, setActiveTab] = useState<TabStep>("personal");

  const steps: TabStep[] = ["personal", "employment", "invite"];

  const getCurrentStepIndex = () => steps.indexOf(activeTab);

  const canProceedNext = () => {
    switch (activeTab) {
      case "personal":
        return validationSchema.validatePersonalData();
      case "employment":
        return validationSchema.validateEmploymentData();
      case "invite":
        return validationSchema.validateInviteData();
      default:
        return false;
    }
  };

  const canProceedPrev = () => {
    return getCurrentStepIndex() > 0;
  };

  const handleNextStep = () => {
    if (canProceedNext()) {
      const currentIndex = getCurrentStepIndex();
      if (currentIndex < steps.length - 1) {
        setActiveTab(steps[currentIndex + 1]);
      }
    }
  };

  const handlePrevStep = () => {
    if (canProceedPrev()) {
      const currentIndex = getCurrentStepIndex();
      if (currentIndex > 0) {
        setActiveTab(steps[currentIndex - 1]);
      }
    }
  };

  return {
    activeTab,
    handleNextStep,
    handlePrevStep,
    setActiveTab,
    canProceedNext: canProceedNext(),
    canProceedPrev: canProceedPrev()
  };
};
