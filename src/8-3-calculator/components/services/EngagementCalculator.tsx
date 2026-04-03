import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { applyVariables } from '@/shared/i18n/translations';
import { EngagementTemplateManager } from './EngagementTemplateManager';

const normalizeCurrencyValue = (value: string) => value.replace(/[^\d]/g, '');

const formatCurrencyDisplay = (value: string) => {
  if (!value) return '';
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return '';
  return new Intl.NumberFormat('id-ID').format(numericValue);
};

const currencyStringToNumber = (value: string) => {
  const numericValue = Number(value);
  return Number.isNaN(numericValue) ? 0 : numericValue;
};

const normalizePercentageValue = (value: string) => {
  if (!value) return '';
  return value.replace(/[^0-9,.\-]/g, '');
};

const percentageStringToNumber = (value: string) => {
  const normalized = value.replace(',', '.');
  const numericValue = Number(normalized);
  return Number.isNaN(numericValue) ? 0 : numericValue;
};

const normalizeFloatValue = (value: string) => value.replace(/[^0-9,.\-]/g, '');

const floatStringToNumber = (value: string) => {
  const normalized = value.replace(',', '.');
  const numericValue = Number(normalized);
  return Number.isNaN(numericValue) ? 0 : numericValue;
};

const formatNumber = (num: number) => new Intl.NumberFormat('id-ID').format(num);

const formatCurrency = (num: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);

interface PercentageInputFieldProps {
  id: string;
  value: string;
  placeholder?: string;
  onValueChange: (value: string) => void;
}

const PercentageInputField = ({
  id,
  value,
  placeholder,
  onValueChange
}: PercentageInputFieldProps) => (
  <div className="relative">
    <Input
      id={id}
      type="text"
      value={value}
      onChange={(e) => onValueChange(normalizePercentageValue(e.target.value))}
      className="mt-1 pr-10"
      placeholder={placeholder}
    />
    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">%</span>
  </div>
);

interface EngagementCalculatorProps {
  initialSettings?: {
    brandingBudget?: string;
    brandingCpm?: string;
    brandingFrequency?: string;
    brandingEngagementRate?: string;
    brandingQualificationRate?: string;
  };
  onSettingsChange?: (settings: {
    brandingBudget: string;
    brandingCpm: string;
    brandingFrequency: string;
    brandingEngagementRate: string;
    brandingQualificationRate: string;
  }) => void;
  onWarmAudienceChange?: (warmAudience: number) => void;
}

const EngagementCalculator = ({
  initialSettings = {},
  onSettingsChange,
  onWarmAudienceChange
}: EngagementCalculatorProps) => {
  const { t } = useAppTranslation();

  const [brandingBudget, setBrandingBudget] = useState<string>(normalizeCurrencyValue(initialSettings.brandingBudget || ''));
  const [brandingCpm, setBrandingCpm] = useState<string>(normalizeCurrencyValue(initialSettings.brandingCpm || ''));
  const [brandingFrequency, setBrandingFrequency] = useState<string>(normalizeFloatValue(initialSettings.brandingFrequency || ''));
  const [brandingEngagementRate, setBrandingEngagementRate] = useState<string>(
    normalizePercentageValue(initialSettings.brandingEngagementRate || '')
  );
  const [brandingQualificationRate, setBrandingQualificationRate] = useState<string>('100');

  // Use ref to track if update is from user input or from props
  const isSyncingFromPropsRef = useRef(false);
  const prevInitialSettingsRef = useRef<string>(JSON.stringify(initialSettings));

  interface EngagementResults {
    brandingImpressions: number;
    brandingReach: number;
    brandingEngagements: number;
    brandingWarmAudience: number;
    brandingCostPerEngagement: number;
  }

  const [results, setResults] = useState<EngagementResults>({
    brandingImpressions: 0,
    brandingReach: 0,
    brandingEngagements: 0,
    brandingWarmAudience: 0,
    brandingCostPerEngagement: 0,
  });

  // Sync state with initialSettings when template is loaded
  useEffect(() => {
    const currentSettingsStr = JSON.stringify({
      brandingBudget: initialSettings.brandingBudget || '',
      brandingCpm: initialSettings.brandingCpm || '',
      brandingFrequency: initialSettings.brandingFrequency || '',
      brandingEngagementRate: initialSettings.brandingEngagementRate || ''
    });
    
    // Only sync if initialSettings actually changed (template was loaded)
    if (currentSettingsStr !== prevInitialSettingsRef.current) {
      prevInitialSettingsRef.current = currentSettingsStr;
      
      const newBudget = normalizeCurrencyValue(initialSettings.brandingBudget || '');
      const newCpm = normalizeCurrencyValue(initialSettings.brandingCpm || '');
      const newFrequency = normalizeFloatValue(initialSettings.brandingFrequency || '');
      const newEngagementRate = normalizePercentageValue(initialSettings.brandingEngagementRate || '');
      
      isSyncingFromPropsRef.current = true;
      
      setBrandingBudget(newBudget);
      setBrandingCpm(newCpm);
      setBrandingFrequency(newFrequency);
      setBrandingEngagementRate(newEngagementRate);
      
      // Reset flag after state updates complete
      // Use requestAnimationFrame to ensure state updates are processed first
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          isSyncingFromPropsRef.current = false;
        });
      });
    }
    // Note: brandingQualificationRate is always '100' by default, not from template
  }, [
    initialSettings.brandingBudget,
    initialSettings.brandingCpm,
    initialSettings.brandingFrequency,
    initialSettings.brandingEngagementRate
  ]);

  // Helper function to notify parent of settings change (only when user makes changes)
  const notifySettingsChange = (updatedSettings: {
    brandingBudget: string;
    brandingCpm: string;
    brandingFrequency: string;
    brandingEngagementRate: string;
    brandingQualificationRate: string;
  }) => {
    if (!isSyncingFromPropsRef.current && onSettingsChange) {
      onSettingsChange(updatedSettings);
    }
  };

  // Handlers that update state and notify parent
  const handleBudgetChange = (value: string) => {
    setBrandingBudget(value);
    notifySettingsChange({
      brandingBudget: value,
      brandingCpm,
      brandingFrequency,
      brandingEngagementRate,
      brandingQualificationRate
    });
  };

  const handleCpmChange = (value: string) => {
    setBrandingCpm(value);
    notifySettingsChange({
      brandingBudget,
      brandingCpm: value,
      brandingFrequency,
      brandingEngagementRate,
      brandingQualificationRate
    });
  };

  const handleFrequencyChange = (value: string) => {
    setBrandingFrequency(value);
    notifySettingsChange({
      brandingBudget,
      brandingCpm,
      brandingFrequency: value,
      brandingEngagementRate,
      brandingQualificationRate
    });
  };

  const handleEngagementRateChange = (value: string) => {
    setBrandingEngagementRate(value);
    notifySettingsChange({
      brandingBudget,
      brandingCpm,
      brandingFrequency,
      brandingEngagementRate: value,
      brandingQualificationRate
    });
  };

  useEffect(() => {
    calculateResults();
  }, [brandingBudget, brandingCpm, brandingFrequency, brandingEngagementRate, brandingQualificationRate]);

  // Notify parent of warm audience changes
  useEffect(() => {
    if (onWarmAudienceChange) {
      onWarmAudienceChange(results.brandingWarmAudience);
    }
  }, [results.brandingWarmAudience, onWarmAudienceChange]);

  const calculateResults = () => {
    const brandingBudgetNum = currencyStringToNumber(brandingBudget);
    const brandingCpmNum = currencyStringToNumber(brandingCpm) || 1;
    const brandingFrequencyNum = floatStringToNumber(brandingFrequency);
    const brandingEngagementRateNum = percentageStringToNumber(brandingEngagementRate);
    const brandingQualificationRateNum = percentageStringToNumber(brandingQualificationRate);

    // If frequency is 0 or less, all results should be 0
    if (brandingFrequencyNum <= 0) {
      setResults({
        brandingImpressions: 0,
        brandingReach: 0,
        brandingEngagements: 0,
        brandingWarmAudience: 0,
        brandingCostPerEngagement: 0,
      });
      return;
    }

    const brandingImpressions = Math.floor((brandingBudgetNum / brandingCpmNum) * 1000);
    const brandingReach = Math.floor(brandingImpressions / brandingFrequencyNum);
    const brandingEngagements = Math.floor(brandingReach * (brandingEngagementRateNum / 100));
    const brandingWarmAudience = Math.floor(brandingEngagements * (brandingQualificationRateNum / 100));
    const brandingCostPerEngagement = brandingEngagements > 0 ? brandingBudgetNum / brandingEngagements : 0;

    setResults({
      brandingImpressions,
      brandingReach,
      brandingEngagements,
      brandingWarmAudience,
      brandingCostPerEngagement,
    });
  };

  const handleResetBranding = () => {
    setBrandingBudget('');
    setBrandingCpm('');
    setBrandingFrequency('1');
    setBrandingEngagementRate('3');
    setBrandingQualificationRate('100');
  };

  const brandingBudgetValue = currencyStringToNumber(brandingBudget);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          {t('pages.calculator.services.engagement.title', 'Objective Engagement')}
        </h2>
        <div className="flex items-center gap-2">
          <EngagementTemplateManager
            currentSettings={{
              brandingBudget,
              brandingCpm,
              brandingFrequency,
              brandingEngagementRate,
              brandingQualificationRate,
            }}
            onLoadTemplate={(settings) => {
              // Set flag to prevent infinite loop
              isSyncingFromPropsRef.current = true;
              
              setBrandingBudget(normalizeCurrencyValue(settings.brandingBudget));
              setBrandingCpm(normalizeCurrencyValue(settings.brandingCpm));
              setBrandingFrequency(normalizeFloatValue(settings.brandingFrequency));
              setBrandingEngagementRate(normalizePercentageValue(settings.brandingEngagementRate));
              setBrandingQualificationRate(settings.brandingQualificationRate || '100');
              
              // Reset flag after state updates
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  isSyncingFromPropsRef.current = false;
                });
              });
            }}
          />
          <Button variant="outline" size="sm" onClick={handleResetBranding}>
            {t('pages.calculator.services.engagement.reset', 'Reset Engagement')}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('pages.calculator.services.engagement.impressions', 'Impressions')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatNumber(results.brandingImpressions)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('pages.calculator.services.engagement.reach', 'Reach (Unique)')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatNumber(results.brandingReach)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('pages.calculator.services.engagement.totalEngagement', 'Total Engagement')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatNumber(results.brandingEngagements)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('pages.calculator.services.engagement.totalEngagementDesc', 'Combined likes, comments, shares, views, and other interaction actions.')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('pages.calculator.services.engagement.costPerEngagement', 'Cost per Engagement')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-primary">{formatCurrency(results.brandingCostPerEngagement)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('pages.calculator.services.engagement.costPerEngagementDesc', 'Average cost for one engagement.')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('pages.calculator.services.engagement.warmAudience', 'Ready for Remarketing Audience')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-primary">{formatNumber(results.brandingWarmAudience)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('pages.calculator.services.engagement.warmAudienceDesc', 'Engaged visitors who pass middle funnel.')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Input Sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Branding KPI */}
        <Card className="border border-primary/15 bg-brand-blue-soft">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              {t('pages.calculator.services.engagement.brandingKPI', 'Branding KPI')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="branding-budget">
                {t('pages.calculator.services.engagement.brandingBudget', 'Budget Branding (Rp)')}
              </Label>
              <Input
                id="branding-budget"
                type="text"
                value={formatCurrencyDisplay(brandingBudget)}
                onChange={(e) => handleBudgetChange(normalizeCurrencyValue(e.target.value))}
                className="mt-1"
                placeholder="0"
              />
            </div>
            <div>
              <Label htmlFor="branding-cpm">
                {t('pages.calculator.services.engagement.brandingCpm', 'CPM Branding (Rp)')}
              </Label>
              <Input
                id="branding-cpm"
                type="text"
                value={formatCurrencyDisplay(brandingCpm)}
                onChange={(e) => handleCpmChange(normalizeCurrencyValue(e.target.value))}
                className="mt-1"
                placeholder="0"
              />
            </div>
            <div>
              <Label htmlFor="branding-frequency">
                {t('pages.calculator.services.engagement.brandingFrequency', 'Average Frequency')}
              </Label>
              <Input
                id="branding-frequency"
                type="text"
                value={brandingFrequency}
                onChange={(e) => handleFrequencyChange(normalizeFloatValue(e.target.value))}
                className="mt-1"
                placeholder="0"
              />
            </div>
          </CardContent>
        </Card>

        {/* Engagement & Consideration KPI */}
        <Card className="border border-primary/15 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              {t('pages.calculator.services.engagement.engagementKPI', 'Engagement & Consideration KPI')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="branding-engagement">
                {t('pages.calculator.services.engagement.engagementRate', 'Engagement Rate (%)')}
              </Label>
              <PercentageInputField
                id="branding-engagement"
                value={brandingEngagementRate}
                onValueChange={handleEngagementRateChange}
                placeholder="0"
              />
            </div>
            <div>
              <Label htmlFor="branding-qualification">
                {t('pages.calculator.services.engagement.warmAudienceRate', 'Warm Audience Rate (%)')}
              </Label>
              <PercentageInputField
                id="branding-qualification"
                value={brandingQualificationRate}
                onValueChange={setBrandingQualificationRate}
                placeholder="100"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t('pages.calculator.services.engagement.warmAudienceNote', 'All engagements are assumed as remarketing audience (100%).')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Branding Funnel Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              {t('pages.calculator.services.engagement.funnelSummary', 'Branding Funnel Summary')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p>• {applyVariables(t('pages.calculator.services.engagement.brandingInvestment', 'Branding investment: {{amount}}'), { amount: formatCurrency(brandingBudgetValue) })}</p>
              <p>• {applyVariables(t('pages.calculator.services.engagement.brandingImpressions', '{{impressions}} impressions to reach {{reach}} people.'), { 
                impressions: formatNumber(results.brandingImpressions), 
                reach: formatNumber(results.brandingReach) 
              })}</p>
              <p>• {applyVariables(t('pages.calculator.services.engagement.brandingEngagements', '{{engagements}} combined engagements achieved.'), { 
                engagements: formatNumber(results.brandingEngagements) 
              })}</p>
              <p>• {applyVariables(t('pages.calculator.services.engagement.brandingWarmAudience', '{{audience}} audience ready for retargeting.'), { 
                audience: formatNumber(results.brandingWarmAudience) 
              })}</p>
              <p>• {applyVariables(t('pages.calculator.services.engagement.brandingCostPerEngagement', 'Cost per engagement: {{cost}}'), { 
                cost: formatCurrency(results.brandingCostPerEngagement) 
              })}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EngagementCalculator;

