import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { applyVariables } from '@/shared/i18n/translations';
import { ConversionTemplateManager } from './ConversionTemplateManager';

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

interface ConversionCalculatorProps {
  initialSettings?: {
    conversionFrequency?: string;
    budget?: string;
    cpm?: string;
    ctrLink?: string;
    adsClickToVisit?: string;
    whatsappClick?: string;
    prospectToClient?: string;
    reservation?: string;
    crossSelling?: string;
    servicePackageValue?: string;
    serviceProfitMargin?: string;
    clientRetentionRate?: string;
    remarketingAudienceSource?: string;
    remarketingAudience?: string;
  };
  onSettingsChange?: (settings: {
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
  brandingWarmAudience?: number; // From Engagement Calculator
  trafficWebsiteVisitors?: number; // From Traffic Calculator
}

const ConversionCalculator = ({
  initialSettings = {},
  onSettingsChange,
  brandingWarmAudience = 0,
  trafficWebsiteVisitors = 0
}: ConversionCalculatorProps) => {
  const { t } = useAppTranslation();

  const [conversionFrequency, setConversionFrequency] = useState<string>(normalizeFloatValue(initialSettings.conversionFrequency || ''));
  const [budget, setBudget] = useState<string>(normalizeCurrencyValue(initialSettings.budget || ''));
  const [cpm, setCpm] = useState<string>(normalizeCurrencyValue(initialSettings.cpm || ''));
  const [ctrLink, setCtrLink] = useState<string>(normalizePercentageValue(initialSettings.ctrLink || ''));
  const [adsClickToVisit, setAdsClickToVisit] = useState<string>(normalizePercentageValue(initialSettings.adsClickToVisit || ''));
  const [whatsappClick, setWhatsappClick] = useState<string>(normalizePercentageValue(initialSettings.whatsappClick || ''));
  const [prospectToClient, setProspectToClient] = useState<string>(normalizePercentageValue(initialSettings.prospectToClient || ''));
  const [reservation, setReservation] = useState<string>(normalizePercentageValue(initialSettings.reservation || ''));
  const [crossSelling, setCrossSelling] = useState<string>(normalizePercentageValue(initialSettings.crossSelling || ''));
  const [servicePackageValue, setServicePackageValue] = useState<string>(normalizeCurrencyValue(initialSettings.servicePackageValue || ''));
  const [serviceProfitMargin, setServiceProfitMargin] = useState<string>(normalizePercentageValue(initialSettings.serviceProfitMargin || ''));
  const [clientRetentionRate, setClientRetentionRate] = useState<string>(normalizePercentageValue(initialSettings.clientRetentionRate || ''));
  const [remarketingAudienceSource, setRemarketingAudienceSource] = useState<string>(initialSettings.remarketingAudienceSource || 'manual');
  const [remarketingAudience, setRemarketingAudience] = useState<string>(normalizeCurrencyValue(initialSettings.remarketingAudience || ''));
  const [activeSettingsTab, setActiveSettingsTab] = useState<'basic' | 'advanced' | 'analysis'>('basic');

  // Use ref to track if update is from user input or from props
  const isSyncingFromPropsRef = useRef(false);
  const prevInitialSettingsRef = useRef<string>(JSON.stringify(initialSettings));

  interface ConversionResults {
    impressions: number;
    calculatedBudget: number;
    leads: number;
    totalClients: number;
    costPerClient: number;
    adClicks: number;
    websiteVisitors: number;
    activeRemarketingAudience: number;
  }

  const [results, setResults] = useState<ConversionResults>({
    impressions: 0,
    calculatedBudget: 0,
    leads: 0,
    totalClients: 0,
    costPerClient: 0,
    adClicks: 0,
    websiteVisitors: 0,
    activeRemarketingAudience: 0,
  });

  // Sync state with initialSettings when template is loaded
  useEffect(() => {
    const currentSettingsStr = JSON.stringify({
      conversionFrequency: initialSettings.conversionFrequency || '',
      budget: initialSettings.budget || '',
      cpm: initialSettings.cpm || '',
      ctrLink: initialSettings.ctrLink || '',
      adsClickToVisit: initialSettings.adsClickToVisit || '',
      whatsappClick: initialSettings.whatsappClick || '',
      prospectToClient: initialSettings.prospectToClient || '',
      reservation: initialSettings.reservation || '',
      crossSelling: initialSettings.crossSelling || '',
      servicePackageValue: initialSettings.servicePackageValue || '',
      serviceProfitMargin: initialSettings.serviceProfitMargin || '',
      clientRetentionRate: initialSettings.clientRetentionRate || '',
      remarketingAudienceSource: initialSettings.remarketingAudienceSource || 'manual',
      remarketingAudience: initialSettings.remarketingAudience || '',
    });
    
    // Only sync if initialSettings actually changed (template was loaded)
    if (currentSettingsStr !== prevInitialSettingsRef.current) {
      prevInitialSettingsRef.current = currentSettingsStr;
      
      isSyncingFromPropsRef.current = true;
      
      setConversionFrequency(normalizeFloatValue(initialSettings.conversionFrequency || ''));
      setBudget(normalizeCurrencyValue(initialSettings.budget || ''));
      setCpm(normalizeCurrencyValue(initialSettings.cpm || ''));
      setCtrLink(normalizePercentageValue(initialSettings.ctrLink || ''));
      setAdsClickToVisit(normalizePercentageValue(initialSettings.adsClickToVisit || ''));
      setWhatsappClick(normalizePercentageValue(initialSettings.whatsappClick || ''));
      setProspectToClient(normalizePercentageValue(initialSettings.prospectToClient || ''));
      setReservation(normalizePercentageValue(initialSettings.reservation || ''));
      setCrossSelling(normalizePercentageValue(initialSettings.crossSelling || ''));
      setServicePackageValue(normalizeCurrencyValue(initialSettings.servicePackageValue || ''));
      setServiceProfitMargin(normalizePercentageValue(initialSettings.serviceProfitMargin || ''));
      setClientRetentionRate(normalizePercentageValue(initialSettings.clientRetentionRate || ''));
      setRemarketingAudienceSource(initialSettings.remarketingAudienceSource || 'manual');
      setRemarketingAudience(normalizeCurrencyValue(initialSettings.remarketingAudience || ''));
      
      // Reset flag after state updates complete
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          isSyncingFromPropsRef.current = false;
        });
      });
    }
  }, [
    initialSettings.conversionFrequency,
    initialSettings.budget,
    initialSettings.cpm,
    initialSettings.ctrLink,
    initialSettings.adsClickToVisit,
    initialSettings.whatsappClick,
    initialSettings.prospectToClient,
    initialSettings.reservation,
    initialSettings.crossSelling,
    initialSettings.servicePackageValue,
    initialSettings.serviceProfitMargin,
    initialSettings.clientRetentionRate,
    initialSettings.remarketingAudienceSource,
    initialSettings.remarketingAudience
  ]);

  // Helper function to notify parent of settings change (only when user makes changes)
  const notifySettingsChange = React.useCallback((updatedSettings: {
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
  }) => {
    if (!isSyncingFromPropsRef.current && onSettingsChange) {
      onSettingsChange(updatedSettings);
    }
  }, [onSettingsChange]);

  useEffect(() => {
    calculateResults();
  }, [
    conversionFrequency,
    budget,
    cpm,
    ctrLink,
    adsClickToVisit,
    whatsappClick,
    prospectToClient,
    reservation,
    crossSelling,
    remarketingAudienceSource,
    remarketingAudience,
    brandingWarmAudience,
    trafficWebsiteVisitors
  ]);

  const calculateResults = () => {
    const conversionFrequencyNum = floatStringToNumber(conversionFrequency);
    const safeConversionFrequency = conversionFrequencyNum > 0 ? conversionFrequencyNum : 1;
    const cpmNum = currencyStringToNumber(cpm) || 1;
    const ctrLinkNum = percentageStringToNumber(ctrLink);
    const adsClickToVisitNum = percentageStringToNumber(adsClickToVisit);
    const whatsappClickNum = percentageStringToNumber(whatsappClick);
    const prospectToClientNum = percentageStringToNumber(prospectToClient);
    const reservationNum = percentageStringToNumber(reservation);
    const crossSellingNum = percentageStringToNumber(crossSelling);

    const remarketingAudienceManualNum = currencyStringToNumber(remarketingAudience);
    let activeRemarketingAudience = 0;
    if (remarketingAudienceSource === 'branding') {
      activeRemarketingAudience = brandingWarmAudience;
    } else if (remarketingAudienceSource === 'traffic') {
      activeRemarketingAudience = trafficWebsiteVisitors;
    } else {
      activeRemarketingAudience = remarketingAudienceManualNum;
    }

    const baseImpressions = activeRemarketingAudience > 0 ? Math.floor(activeRemarketingAudience * safeConversionFrequency) : 0;
    const fallbackBudgetNum = currencyStringToNumber(budget);
    const fallbackImpressions = Math.floor((fallbackBudgetNum / cpmNum) * 1000);
    const impressions = baseImpressions > 0 ? baseImpressions : fallbackImpressions;
    const calculatedBudgetNum = Math.round((impressions / 1000) * cpmNum);

    const adClicks = Math.floor(impressions * (ctrLinkNum / 100));
    const websiteVisitors = Math.floor(adClicks * (adsClickToVisitNum / 100));
    const leads = Math.floor(websiteVisitors * (whatsappClickNum / 100));
    const leadsToPatients = Math.floor(leads * (prospectToClientNum / 100));
    const realPatients = Math.floor(leadsToPatients * (reservationNum / 100));
    const crossSellingMultiplier = crossSellingNum > 0 ? crossSellingNum / 100 : 0;
    const estimatedClients = Math.floor(realPatients * (crossSellingMultiplier > 0 ? crossSellingMultiplier : 1));
    const totalClients = estimatedClients > 0 ? estimatedClients : realPatients;

    const costPerClient = totalClients > 0 ? calculatedBudgetNum / totalClients : 0;

    setResults({
      impressions,
      calculatedBudget: calculatedBudgetNum,
      leads,
      totalClients,
      costPerClient,
      adClicks,
      websiteVisitors,
      activeRemarketingAudience,
    });

    // Update budget if calculated budget is different
    if (budget !== calculatedBudgetNum.toString()) {
      setBudget(calculatedBudgetNum.toString());
    }
  };

  const handleResetConversion = () => {
    setConversionFrequency('');
    setBudget('');
    setCpm('');
    setCtrLink('');
    setAdsClickToVisit('');
    setWhatsappClick('');
    setProspectToClient('');
    setReservation('');
    setCrossSelling('');
    setServicePackageValue('');
    setServiceProfitMargin('');
    setClientRetentionRate('');
    setRemarketingAudienceSource('manual');
    setRemarketingAudience('');
  };

  // Notify parent of changes
  useEffect(() => {
    notifySettingsChange({
      conversionFrequency,
      budget,
      cpm,
      ctrLink,
      adsClickToVisit,
      whatsappClick,
      prospectToClient,
      reservation,
      crossSelling,
      servicePackageValue,
      serviceProfitMargin,
      clientRetentionRate,
      remarketingAudienceSource,
      remarketingAudience,
    });
  }, [
    conversionFrequency,
    budget,
    cpm,
    ctrLink,
    adsClickToVisit,
    whatsappClick,
    prospectToClient,
    reservation,
    crossSelling,
    servicePackageValue,
    serviceProfitMargin,
    clientRetentionRate,
    remarketingAudienceSource,
    remarketingAudience,
    notifySettingsChange
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          {t('pages.calculator.services.conversion.title', 'Objective Conversion')}
        </h2>
        <div className="flex items-center gap-2">
          <ConversionTemplateManager
            currentSettings={{
              conversionFrequency,
              budget,
              cpm,
              ctrLink,
              adsClickToVisit,
              whatsappClick,
              prospectToClient,
              reservation,
              crossSelling,
              servicePackageValue,
              serviceProfitMargin,
              clientRetentionRate,
              remarketingAudienceSource,
              remarketingAudience,
            }}
            onLoadTemplate={(settings) => {
              // Set flag to prevent infinite loop
              isSyncingFromPropsRef.current = true;
              
              setConversionFrequency(normalizeFloatValue(settings.conversionFrequency));
              setBudget(normalizeCurrencyValue(settings.budget));
              setCpm(normalizeCurrencyValue(settings.cpm));
              setCtrLink(normalizePercentageValue(settings.ctrLink));
              setAdsClickToVisit(normalizePercentageValue(settings.adsClickToVisit));
              setWhatsappClick(normalizePercentageValue(settings.whatsappClick));
              setProspectToClient(normalizePercentageValue(settings.prospectToClient));
              setReservation(normalizePercentageValue(settings.reservation));
              setCrossSelling(normalizePercentageValue(settings.crossSelling));
              setServicePackageValue(normalizeCurrencyValue(settings.servicePackageValue));
              setServiceProfitMargin(normalizePercentageValue(settings.serviceProfitMargin));
              setClientRetentionRate(normalizePercentageValue(settings.clientRetentionRate));
              setRemarketingAudienceSource(settings.remarketingAudienceSource);
              setRemarketingAudience(normalizeCurrencyValue(settings.remarketingAudience));
              
              // Reset flag after state updates
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  isSyncingFromPropsRef.current = false;
                });
              });
            }}
          />
          <Button variant="outline" size="sm" onClick={handleResetConversion}>
            {t('pages.calculator.services.conversion.reset', 'Reset Conversion')}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="border border-primary/20 bg-brand-blue-soft/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-brand-blue-on-soft">
              {t('pages.calculator.services.conversion.impressions', 'Conversion Impressions')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-primary">{formatNumber(results.impressions)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('pages.calculator.services.conversion.impressionsDesc', 'Result from remarketing audience × frequency.')}
            </p>
          </CardContent>
        </Card>
        <Card className="border border-primary/25 bg-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-brand-blue-deep">
              {t('pages.calculator.services.conversion.budget', 'Conversion Budget')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-brand-blue-on-soft">{formatCurrency(results.calculatedBudget)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('pages.calculator.services.conversion.budgetDesc', 'Automatically calculated from frequency, CPM, and remarketing audience.')}
            </p>
          </CardContent>
        </Card>
        <Card className="border border-primary/15 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-brand-blue-on-soft">
              {t('pages.calculator.services.conversion.leads', 'Conversion Leads')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-primary">{formatNumber(results.leads)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('pages.calculator.services.conversion.leadsDesc', 'Form submit from remarketing funnel.')}
            </p>
          </CardContent>
        </Card>
        <Card className="border border-primary/15 bg-brand-blue-soft/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-brand-blue-on-soft">
              {t('pages.calculator.services.conversion.totalClients', 'Total Clients')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-primary">{formatNumber(results.totalClients)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('pages.calculator.services.conversion.totalClientsDesc', 'Estimated new clients from conversion campaign.')}
            </p>
          </CardContent>
        </Card>
        <Card className="border border-primary/15 bg-success-muted">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-success-foreground">
              {t('pages.calculator.services.conversion.costPerClient', 'Cost per Client')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-primary">{formatCurrency(results.costPerClient)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('pages.calculator.services.conversion.costPerClientDesc', 'Average cost to acquire one client.')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex items-center justify-between border-b border-primary/10 pb-1">
        <div className="flex space-x-6">
          {[
            { id: 'basic', label: t('pages.calculator.services.conversion.tabs.basic', 'Basic Settings') },
            { id: 'advanced', label: t('pages.calculator.services.conversion.tabs.advanced', 'Service Metrics') },
            { id: 'analysis', label: t('pages.calculator.services.conversion.tabs.analysis', 'Analysis') }
          ].map((tab) => {
            const isActive = activeSettingsTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSettingsTab(tab.id as typeof activeSettingsTab)}
                className={`py-2 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:border-primary/30 hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Basic Settings Tab */}
      {activeSettingsTab === 'basic' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="border border-primary/15 bg-brand-blue-soft">
            <CardHeader>
              <CardTitle>{t('pages.calculator.services.conversion.marketingKPI', 'Marketing KPI')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="remarketing-source">
                  {t('pages.calculator.services.conversion.remarketingSource', 'Remarketing Audience Source')}
                </Label>
                <Select value={remarketingAudienceSource} onValueChange={setRemarketingAudienceSource}>
                  <SelectTrigger id="remarketing-source" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">
                      {t('pages.calculator.services.conversion.manualInput', 'Manual Input')}
                    </SelectItem>
                    <SelectItem value="branding" disabled={brandingWarmAudience === 0}>
                      {applyVariables(t('pages.calculator.services.conversion.brandingAudience', 'Branding Audience ({{count}} engagement)'), { count: formatNumber(brandingWarmAudience) })}
                    </SelectItem>
                    <SelectItem value="traffic" disabled={trafficWebsiteVisitors === 0}>
                      {applyVariables(t('pages.calculator.services.conversion.trafficAudience', 'Traffic Audience ({{count}} visitors)'), { count: formatNumber(trafficWebsiteVisitors) })}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="remarketingAudience">
                  {t('pages.calculator.services.conversion.remarketingAudienceCount', 'Remarketing Audience Count (people)')}
                </Label>
                <Input
                  id="remarketingAudience"
                  type="text"
                  value={
                    remarketingAudienceSource === 'branding'
                      ? formatNumber(brandingWarmAudience)
                      : remarketingAudienceSource === 'traffic'
                      ? formatNumber(trafficWebsiteVisitors)
                      : formatCurrencyDisplay(remarketingAudience)
                  }
                  onChange={(e) => setRemarketingAudience(normalizeCurrencyValue(e.target.value))}
                  className="mt-1"
                  placeholder="0"
                  disabled={remarketingAudienceSource === 'branding' || remarketingAudienceSource === 'traffic'}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {remarketingAudienceSource === 'branding'
                    ? t('pages.calculator.services.conversion.usingBrandingAudience', 'Using total Branding engagement as remarketing audience.')
                    : remarketingAudienceSource === 'traffic'
                    ? t('pages.calculator.services.conversion.usingTrafficAudience', 'Using total Traffic website visitors as remarketing audience.')
                    : t('pages.calculator.services.conversion.manualAudience', 'Enter estimated remarketing audience if using other database.')}
                </p>
              </div>
              <div>
                <Label htmlFor="conversion-frequency">
                  {t('pages.calculator.services.conversion.frequency', 'Remarketing Frequency')}
                </Label>
                <Input
                  id="conversion-frequency"
                  type="text"
                  value={conversionFrequency}
                  onChange={(e) => setConversionFrequency(normalizeFloatValue(e.target.value))}
                  className="mt-1"
                  placeholder="7"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('pages.calculator.services.conversion.frequencyDesc', 'Average number of ad impressions per warm audience. Recommendation 7-8 times to drive decisions.')}
                </p>
              </div>
              <div>
                <Label htmlFor="cpm">CPM (Rp)</Label>
                <Input
                  id="cpm"
                  type="text"
                  value={formatCurrencyDisplay(cpm)}
                  onChange={(e) => setCpm(normalizeCurrencyValue(e.target.value))}
                  className="mt-1"
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="budget">Budget (Rp)</Label>
                <Input
                  id="budget"
                  type="text"
                  value={formatCurrency(results.calculatedBudget)}
                  disabled
                  className="mt-1 bg-muted text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('pages.calculator.services.conversion.autoCalculated', 'Automatically calculated from frequency × remarketing audience × CPM.')}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-destructive/20 bg-destructive/5">
            <CardHeader>
              <CardTitle>{t('pages.calculator.services.conversion.conversionRates', 'Conversion Rates')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="ctr">CTR Link (%)</Label>
                <PercentageInputField
                  id="ctr"
                  value={ctrLink}
                  onValueChange={setCtrLink}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="adsClick">% Ads Click To Visit Page</Label>
                <PercentageInputField
                  id="adsClick"
                  value={adsClickToVisit}
                  onValueChange={setAdsClickToVisit}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="whatsapp">Visitor yang Submit Form</Label>
                <PercentageInputField
                  id="whatsapp"
                  value={whatsappClick}
                  onValueChange={setWhatsappClick}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="prospect">Prospek to Client</Label>
                <PercentageInputField
                  id="prospect"
                  value={prospectToClient}
                  onValueChange={setProspectToClient}
                  placeholder="0"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-primary/15 bg-success-muted">
            <CardHeader>
              <CardTitle>{t('pages.calculator.services.conversion.servicePackage', 'Service Package')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="reservationInput">Register / Reservasi (%)</Label>
                <PercentageInputField
                  id="reservationInput"
                  value={reservation}
                  onValueChange={setReservation}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="crossSellingBasic">Up Selling / Cross Selling (%)</Label>
                <PercentageInputField
                  id="crossSellingBasic"
                  value={crossSelling}
                  onValueChange={setCrossSelling}
                  placeholder="0"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>{t('pages.calculator.services.conversion.funnelAnalysis', 'Conversion Funnel Analysis')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center">
                    <span className="text-primary mr-2">📊</span>
                    <span>{applyVariables(t('pages.calculator.services.conversion.funnel.impressions', 'Impressions: {{count}} impressions'), { count: formatNumber(results.impressions) })}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-primary mr-2">👆</span>
                    <span>{applyVariables(t('pages.calculator.services.conversion.funnel.adClicks', 'Ad clicks: {{count}} people'), { count: formatNumber(results.adClicks) })}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-primary mr-2">🌐</span>
                    <span>{applyVariables(t('pages.calculator.services.conversion.funnel.websiteVisitors', 'Website visitors: {{count}} people'), { count: formatNumber(results.websiteVisitors) })}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-primary mr-2">📞</span>
                    <span>{applyVariables(t('pages.calculator.services.conversion.funnel.formSubmit', 'Form submit: {{count}} people'), { count: formatNumber(results.leads) })}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="mr-2 text-primary">🎯</span>
                    <span>{applyVariables(t('pages.calculator.services.conversion.funnel.totalClients', 'Total clients: {{count}} clients'), { count: formatNumber(results.totalClients) })}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="mr-2 text-primary">♻️</span>
                    <span>{applyVariables(t('pages.calculator.services.conversion.funnel.activeRemarketingAudience', 'Active remarketing audience: {{count}} people'), { count: formatNumber(results.activeRemarketingAudience) })}</span>
                  </div>
                </div>

                <div className="space-y-2 border-l pl-6">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">📊</span>
                    <div className="bg-muted px-3 py-1 rounded text-sm font-medium text-foreground">
                      {formatNumber(results.impressions)} {'>'} IMPRESSIONS
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">👆</span>
                    <div className="bg-muted px-3 py-1 rounded text-sm font-medium text-foreground">
                      {formatNumber(results.adClicks)} {'>'} CLICKS
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">🌐</span>
                    <div className="bg-muted px-3 py-1 rounded text-sm font-medium text-foreground">
                      {formatNumber(results.websiteVisitors)} {'>'} VISITORS
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">📞</span>
                    <div className="bg-primary/15 px-3 py-1 rounded text-sm font-medium text-primary">
                      {formatNumber(results.leads)} {'>'} LEADS
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">🎯</span>
                    <div className="rounded bg-primary/20 px-3 py-1 text-sm font-medium text-primary">
                      {formatNumber(results.totalClients)} {'>'} TOTAL CLIENTS
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Advanced Settings Tab */}
      {activeSettingsTab === 'advanced' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="border border-primary/15 bg-accent">
            <CardHeader>
              <CardTitle>{t('pages.calculator.services.conversion.clientLifecycle', 'Client Lifecycle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="retention">Client Retention Rate (%)</Label>
                <PercentageInputField
                  id="retention"
                  value={clientRetentionRate}
                  onValueChange={setClientRetentionRate}
                  placeholder="0"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-primary/15 bg-success-muted">
            <CardHeader>
              <CardTitle>{t('pages.calculator.services.conversion.serviceFinancial', 'Service Financial Metrics')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="serviceValue">Service Package Value (Rp)</Label>
                <Input
                  id="serviceValue"
                  type="text"
                  value={formatCurrencyDisplay(servicePackageValue)}
                  onChange={(e) => setServicePackageValue(normalizeCurrencyValue(e.target.value))}
                  className="mt-1"
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="profitMargin">Service Profit Margin (%)</Label>
                <PercentageInputField
                  id="profitMargin"
                  value={serviceProfitMargin}
                  onValueChange={setServiceProfitMargin}
                  placeholder="0"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('pages.calculator.services.conversion.keyMetrics', 'Conversion Key Metrics')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t('pages.calculator.services.conversion.totalClients', 'Total Clients')}</Label>
                <div className="mt-1 text-2xl font-semibold text-primary">
                  {formatNumber(results.totalClients)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('pages.calculator.services.conversion.totalClientsDesc', 'Estimated new clients from conversion campaign.')}
                </p>
              </div>
              <div>
                <Label>{t('pages.calculator.services.conversion.costPerClient', 'Cost per Client')}</Label>
                <div className="mt-1 text-2xl font-semibold text-primary">
                  {formatCurrency(results.costPerClient)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('pages.calculator.services.conversion.costPerClientDesc', 'Average cost to acquire one client.')}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Analysis Tab */}
      {activeSettingsTab === 'analysis' && (
        <Card className="border border-primary/15 bg-brand-blue-soft">
          <CardHeader>
            <CardTitle>{t('pages.calculator.services.conversion.optimization', 'Optimization Recommendations')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('pages.calculator.services.conversion.analysisPlaceholder', 'Analysis and recommendations will be displayed here based on your input values.')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ConversionCalculator;

