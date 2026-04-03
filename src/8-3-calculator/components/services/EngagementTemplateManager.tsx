import React from 'react';
import { SaveTemplateModal } from '../SaveTemplateModal';
import { LoadTemplateModal } from '../LoadTemplateModal';
import { ServiceKPISettings } from '@/8-3-calculator/types/kpi-templates';

interface EngagementTemplateManagerProps {
  currentSettings: {
    brandingBudget: string;
    brandingCpm: string;
    brandingFrequency: string;
    brandingEngagementRate: string;
    brandingQualificationRate: string;
  };
  onLoadTemplate: (settings: {
    brandingBudget: string;
    brandingCpm: string;
    brandingFrequency: string;
    brandingEngagementRate: string;
    brandingQualificationRate: string;
  }) => void;
}

export const EngagementTemplateManager: React.FC<EngagementTemplateManagerProps> = ({
  currentSettings,
  onLoadTemplate
}) => {
  // Convert engagement settings to ServiceKPISettings format for saving
  const fullSettings: ServiceKPISettings = {
    brandingBudget: currentSettings.brandingBudget,
    brandingCpm: currentSettings.brandingCpm,
    brandingFrequency: currentSettings.brandingFrequency,
    brandingEngagementRate: currentSettings.brandingEngagementRate,
    brandingQualificationRate: currentSettings.brandingQualificationRate,
    conversionFrequency: '',
    budget: '',
    cpm: '',
    ctrLink: '',
    adsClickToVisit: '',
    whatsappClick: '',
    prospectToClient: '',
    reservation: '',
    crossSelling: '',
    servicePackageValue: '',
    serviceProfitMargin: '',
    clientRetentionRate: '',
    remarketingAudienceSource: 'manual',
    remarketingAudience: '',
  };

  // Handle template load - extract only engagement fields
  const handleLoadTemplate = (settings: ServiceKPISettings | any) => {
    onLoadTemplate({
      brandingBudget: settings.brandingBudget || '',
      brandingCpm: settings.brandingCpm || '',
      brandingFrequency: settings.brandingFrequency || '',
      brandingEngagementRate: settings.brandingEngagementRate || '',
      brandingQualificationRate: settings.brandingQualificationRate || '100',
    });
  };

  return (
    <div className="flex gap-2">
      <SaveTemplateModal
        calculatorType="services"
        currentSettings={fullSettings}
        onSaveSuccess={() => {}}
      />
      <LoadTemplateModal
        calculatorType="services"
        onLoadTemplate={handleLoadTemplate}
      />
    </div>
  );
};

