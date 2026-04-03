import { forwardRef } from 'react';
import { PricingWizard, PricingWizardRef } from './PricingWizard';
import { PricingCalculationResult, PricingCalculationInput } from '../types/pricingTypes';

interface StepChangeData {
  currentStep: number;
  finalSellingPrice?: number;
  marketingCostPerUnit?: number;
  channelFeePercent?: number;
  baseTotalCostPerUnit?: number;
}

interface PricingToolsLayoutProps {
  onCalculate?: (results: PricingCalculationResult, input: PricingCalculationInput) => void;
  onStepChange?: (data: StepChangeData) => void;
}

export const PricingToolsLayout = forwardRef<PricingWizardRef, PricingToolsLayoutProps>(
  ({ onCalculate, onStepChange }, ref) => {
    return (
      <div className="w-full h-full">
        <PricingWizard ref={ref} onCalculate={onCalculate} onStepChange={onStepChange} />
      </div>
    );
  }
);

PricingToolsLayout.displayName = 'PricingToolsLayout';
