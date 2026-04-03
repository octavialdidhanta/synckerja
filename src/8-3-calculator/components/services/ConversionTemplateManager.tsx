import React from 'react';
import { SaveTemplateModal } from '../SaveTemplateModal';
import { LoadTemplateModal } from '../LoadTemplateModal';
import { ServiceKPISettings } from '@/8-3-calculator/types/kpi-templates';

interface ConversionTemplateManagerProps {
  currentSettings: {
    conversionFrequency: string;
    budget: string;
    cpm: string;
    ctrLink: string;
    adsClickToVisit: string;
    whatsappClick: string;
    prospectToClient: string;
    reservation: string;
    crossSelling: string;
    servicePackageValue: string;
    serviceProfitMargin: string;
    clientRetentionRate: string;
    remarketingAudienceSource: string;
    remarketingAudience: string;
  };
  onLoadTemplate: (settings: {
    conversionFrequency: string;
    budget: string;
    cpm: string;
    ctrLink: string;
    adsClickToVisit: string;
    whatsappClick: string;
    prospectToClient: string;
    reservation: string;
    crossSelling: string;
    servicePackageValue: string;
    serviceProfitMargin: string;
    clientRetentionRate: string;
    remarketingAudienceSource: string;
    remarketingAudience: string;
  }) => void;
}

export const ConversionTemplateManager: React.FC<ConversionTemplateManagerProps> = ({
  currentSettings,
  onLoadTemplate
}) => {
  // Convert conversion settings to ServiceKPISettings format for saving
  const fullSettings: ServiceKPISettings = {
    brandingBudget: '',
    brandingCpm: '',
    brandingFrequency: '',
    brandingEngagementRate: '',
    brandingQualificationRate: '',
    conversionFrequency: currentSettings.conversionFrequency,
    budget: currentSettings.budget,
    cpm: currentSettings.cpm,
    ctrLink: currentSettings.ctrLink,
    adsClickToVisit: currentSettings.adsClickToVisit,
    whatsappClick: currentSettings.whatsappClick,
    prospectToClient: currentSettings.prospectToClient,
    reservation: currentSettings.reservation,
    crossSelling: currentSettings.crossSelling,
    servicePackageValue: currentSettings.servicePackageValue,
    serviceProfitMargin: currentSettings.serviceProfitMargin,
    clientRetentionRate: currentSettings.clientRetentionRate,
    remarketingAudienceSource: currentSettings.remarketingAudienceSource,
    remarketingAudience: currentSettings.remarketingAudience,
  };

  // Handle template load - extract only conversion fields
  const handleLoadTemplate = (settings: ServiceKPISettings | any) => {
    onLoadTemplate({
      conversionFrequency: settings.conversionFrequency || '',
      budget: settings.budget || '',
      cpm: settings.cpm || '',
      ctrLink: settings.ctrLink || '',
      adsClickToVisit: settings.adsClickToVisit || '',
      whatsappClick: settings.whatsappClick || '',
      prospectToClient: settings.prospectToClient || '',
      reservation: settings.reservation || '',
      crossSelling: settings.crossSelling || '',
      servicePackageValue: settings.servicePackageValue || '',
      serviceProfitMargin: settings.serviceProfitMargin || '',
      clientRetentionRate: settings.clientRetentionRate || '',
      remarketingAudienceSource: settings.remarketingAudienceSource || 'manual',
      remarketingAudience: settings.remarketingAudience || '',
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

