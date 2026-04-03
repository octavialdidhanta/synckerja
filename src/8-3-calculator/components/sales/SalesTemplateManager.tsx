import React from 'react';
import { SaveTemplateModal } from '../SaveTemplateModal';
import { LoadTemplateModal } from '../LoadTemplateModal';
import { SalesKPISettings } from '@/8-3-calculator/types/kpi-templates';

interface SalesTemplateManagerProps {
  currentSettings: SalesKPISettings;
  onLoadTemplate: (settings: SalesKPISettings) => void;
}

const SalesTemplateManager: React.FC<SalesTemplateManagerProps> = ({
  currentSettings,
  onLoadTemplate,
}) => {
  return (
    <div className="flex gap-2">
      <SaveTemplateModal
        calculatorType="sales"
        currentSettings={currentSettings}
      />
      <LoadTemplateModal
        calculatorType="sales"
        onLoadTemplate={onLoadTemplate}
      />
    </div>
  );
};

export { SalesTemplateManager };

