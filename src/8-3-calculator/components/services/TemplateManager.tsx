import React from 'react';
import { SaveTemplateModal } from '../SaveTemplateModal';
import { LoadTemplateModal } from '../LoadTemplateModal';
import { CalculatorType, ServiceKPISettings, SalesKPISettings } from '@/8-3-calculator/types/kpi-templates';

interface TemplateManagerProps {
  calculatorType: CalculatorType;
  currentSettings: ServiceKPISettings | SalesKPISettings;
  onLoadTemplate: (settings: ServiceKPISettings | SalesKPISettings) => void;
  onSaveSuccess?: () => void;
}

const TemplateManager: React.FC<TemplateManagerProps> = ({
  calculatorType,
  currentSettings,
  onLoadTemplate,
  onSaveSuccess
}) => {
  return (
    <div className="flex gap-2">
      <SaveTemplateModal
        calculatorType={calculatorType}
        currentSettings={currentSettings}
        onSaveSuccess={onSaveSuccess}
      />
      <LoadTemplateModal
        calculatorType={calculatorType}
        onLoadTemplate={onLoadTemplate}
      />
    </div>
  );
};

export default TemplateManager;

