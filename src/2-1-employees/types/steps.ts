import type { Dispatch, SetStateAction } from 'react';

/** Add Employee wizard steps (see hooks/useStepNavigation). */
export type TabStep = 'personal' | 'employment' | 'invite';

export interface ValidationSchema {
  validatePersonalData: () => boolean;
  validateEmploymentData: () => boolean;
  validateInviteData: () => boolean;
}

export interface StepNavigation {
  activeTab: TabStep;
  handleNextStep: () => void;
  handlePrevStep: () => void;
  setActiveTab: Dispatch<SetStateAction<TabStep>>;
  canProceedNext: boolean;
  canProceedPrev: boolean;
}
