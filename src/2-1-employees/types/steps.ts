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
  /** Accepts the raw tab value from the tab UI (string). */
  setActiveTab: (tab: string) => void;
  canProceedNext: boolean;
  canProceedPrev: boolean;
}
