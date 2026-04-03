import React from 'react';
import { SaveTemplateModal } from '../SaveTemplateModal';
import { LoadTemplateModal } from '../LoadTemplateModal';
import { ServiceKPISettings } from '@/8-3-calculator/types/kpi-templates';

interface TrafficTemplateManagerProps {
  currentSettings: {
    budget: string;
    cpm: string;
    cpc: string;
    ctrLink: string;
    adsClickToVisit: string;
    adType: 'meta' | 'google';
  };
  onLoadTemplate: (settings: {
    budget: string;
    cpm: string;
    cpc: string;
    ctrLink: string;
    adsClickToVisit: string;
    adType: 'meta' | 'google';
  }) => void;
}

export const TrafficTemplateManager: React.FC<TrafficTemplateManagerProps> = ({
  currentSettings,
  onLoadTemplate
}) => {
  // Convert traffic settings to ServiceKPISettings format for saving
  const fullSettings: ServiceKPISettings = {
    brandingBudget: '',
    brandingCpm: '',
    brandingFrequency: '',
    brandingEngagementRate: '',
    brandingQualificationRate: '',
    conversionFrequency: '',
    budget: currentSettings.budget,
    cpm: currentSettings.cpm,
    cpc: currentSettings.cpc,
    ctrLink: currentSettings.ctrLink,
    adsClickToVisit: currentSettings.adsClickToVisit,
    whatsappClick: '',
    prospectToClient: '',
    reservation: '',
    crossSelling: '',
    servicePackageValue: '',
    serviceProfitMargin: '',
    clientRetentionRate: '',
    remarketingAudienceSource: 'manual',
    remarketingAudience: '',
    adType: currentSettings.adType,
  };

  // Handle template load - extract only traffic fields
  const handleLoadTemplate = (settings: ServiceKPISettings | any) => {
    onLoadTemplate({
      budget: settings.budget || '',
      cpm: settings.cpm || '',
      cpc: settings.cpc || '',
      ctrLink: settings.ctrLink || '',
      adsClickToVisit: settings.adsClickToVisit || '',
      adType: settings.adType || 'meta',
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

