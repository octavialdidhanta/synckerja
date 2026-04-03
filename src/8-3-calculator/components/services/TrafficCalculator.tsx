import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { applyVariables } from '@/shared/i18n/translations';
import { TrafficTemplateManager } from './TrafficTemplateManager';

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

interface TrafficCalculatorProps {
  initialSettings?: {
    budget?: string;
    cpm?: string;
    cpc?: string;
    ctrLink?: string;
    adsClickToVisit?: string;
    adType?: 'meta' | 'google';
  };
  onSettingsChange?: (settings: {
    budget: string;
    cpm: string;
    cpc: string;
    ctrLink: string;
    adsClickToVisit: string;
    adType: 'meta' | 'google';
  }) => void;
  onWebsiteVisitorsChange?: (websiteVisitors: number) => void;
}

const TrafficCalculator = ({
  initialSettings = {},
  onSettingsChange,
  onWebsiteVisitorsChange
}: TrafficCalculatorProps) => {
  const { t } = useAppTranslation();

  const [adType, setAdType] = useState<'meta' | 'google'>(initialSettings.adType || 'meta');
  const [budget, setBudget] = useState<string>(normalizeCurrencyValue(initialSettings.budget || ''));
  const [cpm, setCpm] = useState<string>(normalizeCurrencyValue(initialSettings.cpm || ''));
  const [cpc, setCpc] = useState<string>(normalizeCurrencyValue(initialSettings.cpc || ''));
  const [ctrLink, setCtrLink] = useState<string>(normalizePercentageValue(initialSettings.ctrLink || ''));
  const [adsClickToVisit, setAdsClickToVisit] = useState<string>(normalizePercentageValue(initialSettings.adsClickToVisit || ''));

  // Use ref to track if update is from user input or from props
  const isSyncingFromPropsRef = useRef(false);
  const prevInitialSettingsRef = useRef<string>(JSON.stringify(initialSettings));

  interface TrafficResults {
    impressions: number;
    adClicks: number;
    websiteVisitors: number;
    costPerClick: number;
  }

  const [results, setResults] = useState<TrafficResults>({
    impressions: 0,
    adClicks: 0,
    websiteVisitors: 0,
    costPerClick: 0,
  });

  // Sync state with initialSettings when template is loaded
  useEffect(() => {
    const currentSettingsStr = JSON.stringify({
      budget: initialSettings.budget || '',
      cpm: initialSettings.cpm || '',
      cpc: initialSettings.cpc || '',
      ctrLink: initialSettings.ctrLink || '',
      adsClickToVisit: initialSettings.adsClickToVisit || '',
      adType: initialSettings.adType || 'meta'
    });
    
    // Only sync if initialSettings actually changed (template was loaded)
    if (currentSettingsStr !== prevInitialSettingsRef.current) {
      prevInitialSettingsRef.current = currentSettingsStr;
      
      const newBudget = normalizeCurrencyValue(initialSettings.budget || '');
      const newCpm = normalizeCurrencyValue(initialSettings.cpm || '');
      const newCpc = normalizeCurrencyValue(initialSettings.cpc || '');
      const newCtrLink = normalizePercentageValue(initialSettings.ctrLink || '');
      const newAdsClickToVisit = normalizePercentageValue(initialSettings.adsClickToVisit || '');
      const newAdType = initialSettings.adType || 'meta';
      
      isSyncingFromPropsRef.current = true;
      
      setAdType(newAdType);
      setBudget(newBudget);
      setCpm(newCpm);
      setCpc(newCpc);
      setCtrLink(newCtrLink);
      setAdsClickToVisit(newAdsClickToVisit);
      
      // Reset flag after state updates complete
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          isSyncingFromPropsRef.current = false;
        });
      });
    }
  }, [
    initialSettings.budget,
    initialSettings.cpm,
    initialSettings.cpc,
    initialSettings.ctrLink,
    initialSettings.adsClickToVisit,
    initialSettings.adType
  ]);

  // Helper function to notify parent of settings change (only when user makes changes)
  const notifySettingsChange = (updatedSettings: {
    budget: string;
    cpm: string;
    cpc: string;
    ctrLink: string;
    adsClickToVisit: string;
    adType: 'meta' | 'google';
  }) => {
    if (!isSyncingFromPropsRef.current && onSettingsChange) {
      onSettingsChange(updatedSettings);
    }
  };

  // Handlers that update state and notify parent
  const handleAdTypeChange = (value: 'meta' | 'google') => {
    setAdType(value);
    notifySettingsChange({
      budget,
      cpm,
      cpc,
      ctrLink,
      adsClickToVisit,
      adType: value
    });
  };

  const handleBudgetChange = (value: string) => {
    setBudget(value);
    notifySettingsChange({
      budget: value,
      cpm,
      cpc,
      ctrLink,
      adsClickToVisit,
      adType
    });
  };

  const handleCpmChange = (value: string) => {
    setCpm(value);
    notifySettingsChange({
      budget,
      cpm: value,
      cpc,
      ctrLink,
      adsClickToVisit,
      adType
    });
  };

  const handleCpcChange = (value: string) => {
    setCpc(value);
    notifySettingsChange({
      budget,
      cpm,
      cpc: value,
      ctrLink,
      adsClickToVisit,
      adType
    });
  };

  const handleCtrLinkChange = (value: string) => {
    setCtrLink(value);
    notifySettingsChange({
      budget,
      cpm,
      cpc,
      ctrLink: value,
      adsClickToVisit,
      adType
    });
  };

  const handleAdsClickToVisitChange = (value: string) => {
    setAdsClickToVisit(value);
    notifySettingsChange({
      budget,
      cpm,
      cpc,
      ctrLink,
      adsClickToVisit: value,
      adType
    });
  };

  useEffect(() => {
    calculateResults();
  }, [budget, cpm, cpc, ctrLink, adsClickToVisit, adType]);

  const calculateResults = () => {
    const budgetNum = currencyStringToNumber(budget);
    const adsClickToVisitNum = percentageStringToNumber(adsClickToVisit);

    let impressions = 0;
    let adClicks = 0;
    let costPerClick = 0;

    if (adType === 'meta') {
      // Meta Ads: CPM-based calculation (CTR-driven)
      const cpmNum = currencyStringToNumber(cpm) || 1;
      const ctrLinkNum = percentageStringToNumber(ctrLink);
      
      impressions = Math.floor((budgetNum / cpmNum) * 1000);
      adClicks = Math.floor(impressions * (ctrLinkNum / 100));
      costPerClick = adClicks > 0 ? budgetNum / adClicks : 0;
    } else {
      // Google Ads: CTR-driven calculation
      // CPC is calculated based on CTR (higher CTR = better Quality Score = lower CPC)
      const ctrLinkNum = percentageStringToNumber(ctrLink);
      const baseCpcNum = currencyStringToNumber(cpc);
      
      if (baseCpcNum > 0) {
        // Google Ads: CPC-based calculation (no discount)
        // Base CPC = Actual CPC (what you pay)
        // CTR only affects Ad Clicks and Impressions calculation
        costPerClick = baseCpcNum;
        
        // Calculate Ad Clicks from Budget and CPC
        adClicks = Math.floor(budgetNum / baseCpcNum);
        
        // Calculate Impressions from Ad Clicks and CTR
        if (ctrLinkNum > 0) {
          impressions = Math.floor((adClicks / ctrLinkNum) * 100);
        } else {
          impressions = 0;
        }
      } else {
        // If Base CPC is not set, show 0
        adClicks = 0;
        costPerClick = 0;
        impressions = 0;
      }
    }

    const websiteVisitors = Math.floor(adClicks * (adsClickToVisitNum / 100));

    setResults({
      impressions,
      adClicks,
      websiteVisitors,
      costPerClick,
    });

    // Notify parent of website visitors changes
    if (onWebsiteVisitorsChange) {
      onWebsiteVisitorsChange(websiteVisitors);
    }
  };

  const handleResetTraffic = () => {
    setAdType('meta');
    setBudget('');
    setCpm('');
    setCpc('');
    setCtrLink('');
    setAdsClickToVisit('');
  };

  const budgetValue = currencyStringToNumber(budget);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          {t('pages.calculator.services.traffic.title', 'Objective Traffic')}
        </h2>
        <div className="flex items-center gap-2">
          {/* Ad Platform Selector */}
          <div className="flex items-center gap-2">
            <Label htmlFor="ad-type" className="text-sm font-medium whitespace-nowrap">
              {t('pages.calculator.services.traffic.adType', 'Ad Platform')}
            </Label>
            <Select value={adType} onValueChange={handleAdTypeChange}>
              <SelectTrigger id="ad-type" className="h-9 w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="meta">
                  {t('pages.calculator.services.traffic.metaAds', 'Meta Ads (CPM)')}
                </SelectItem>
                <SelectItem value="google">
                  {t('pages.calculator.services.traffic.googleAds', 'Google Ads (CPC)')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <TrafficTemplateManager
            currentSettings={{
              budget,
              cpm,
              cpc,
              ctrLink,
              adsClickToVisit,
              adType,
            }}
            onLoadTemplate={(settings) => {
              // Set flag to prevent infinite loop
              isSyncingFromPropsRef.current = true;
              
              setBudget(normalizeCurrencyValue(settings.budget));
              setCpm(normalizeCurrencyValue(settings.cpm));
              setCpc(normalizeCurrencyValue(settings.cpc));
              setCtrLink(normalizePercentageValue(settings.ctrLink));
              setAdsClickToVisit(normalizePercentageValue(settings.adsClickToVisit));
              setAdType(settings.adType);
              
              // Reset flag after state updates
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  isSyncingFromPropsRef.current = false;
                });
              });
            }}
          />
          <Button variant="outline" size="sm" onClick={handleResetTraffic}>
            {t('pages.calculator.services.traffic.reset', 'Reset Traffic')}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('pages.calculator.services.traffic.impressions', 'Impressions')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatNumber(results.impressions)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('pages.calculator.services.traffic.adClicks', 'Ad Clicks')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatNumber(results.adClicks)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('pages.calculator.services.traffic.adClicksDesc', 'Total clicks on your ads.')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('pages.calculator.services.traffic.websiteVisitors', 'Website Visitors')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-primary">{formatNumber(results.websiteVisitors)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('pages.calculator.services.traffic.websiteVisitorsDesc', 'Visitors who landed on your website.')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('pages.calculator.services.traffic.costPerClick', 'Cost per Click')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-primary">{formatCurrency(results.costPerClick)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('pages.calculator.services.traffic.costPerClickDesc', 'Average cost for one click.')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Input Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Traffic KPI */}
        <Card className="border border-primary/15 bg-success-muted">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              {t('pages.calculator.services.traffic.trafficKPI', 'Traffic KPI')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="traffic-budget">
                {t('pages.calculator.services.traffic.budget', 'Budget (Rp)')}
              </Label>
              <Input
                id="traffic-budget"
                type="text"
                value={formatCurrencyDisplay(budget)}
                onChange={(e) => handleBudgetChange(normalizeCurrencyValue(e.target.value))}
                className="mt-1"
                placeholder="0"
              />
            </div>
            {adType === 'meta' ? (
              <>
                <div>
                  <Label htmlFor="traffic-cpm">
                    {t('pages.calculator.services.traffic.cpm', 'CPM (Rp)')}
                  </Label>
                  <Input
                    id="traffic-cpm"
                    type="text"
                    value={formatCurrencyDisplay(cpm)}
                    onChange={(e) => handleCpmChange(normalizeCurrencyValue(e.target.value))}
                    className="mt-1"
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('pages.calculator.services.traffic.cpmDesc', 'Cost per 1000 impressions for Meta Ads.')}
                  </p>
                </div>
                <div>
                  <Label htmlFor="traffic-ctr">
                    {t('pages.calculator.services.traffic.ctrLink', 'CTR Link (%)')}
                  </Label>
                  <PercentageInputField
                    id="traffic-ctr"
                    value={ctrLink}
                    onValueChange={handleCtrLinkChange}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('pages.calculator.services.traffic.ctrMetaDesc', 'Click-through rate to calculate ad clicks from impressions.')}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label htmlFor="traffic-ctr-google">
                    {t('pages.calculator.services.traffic.ctrLink', 'CTR Link (%)')}
                  </Label>
                  <PercentageInputField
                    id="traffic-ctr-google"
                    value={ctrLink}
                    onValueChange={handleCtrLinkChange}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('pages.calculator.services.traffic.ctrGoogleDesc', 'Click-through rate to calculate impressions from ad clicks.')}
                  </p>
                </div>
                <div>
                  <Label htmlFor="traffic-cpc">
                    {t('pages.calculator.services.traffic.cpc', 'CPC (Rp)')}
                  </Label>
                  <Input
                    id="traffic-cpc"
                    type="text"
                    value={formatCurrencyDisplay(cpc)}
                    onChange={(e) => handleCpcChange(normalizeCurrencyValue(e.target.value))}
                    className="mt-1"
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('pages.calculator.services.traffic.cpcDesc', 'Cost per click for Google Ads. This is the actual CPC you pay.')}
                  </p>
                </div>
              </>
            )}
            <div>
              <Label htmlFor="traffic-click-to-visit">
                {t('pages.calculator.services.traffic.adsClickToVisit', 'Click to Visit Rate (%)')}
              </Label>
              <PercentageInputField
                id="traffic-click-to-visit"
                value={adsClickToVisit}
                onValueChange={handleAdsClickToVisitChange}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t('pages.calculator.services.traffic.adsClickToVisitDesc', 'Percentage of clicks that result in website visits.')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Traffic Funnel Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              {t('pages.calculator.services.traffic.funnelSummary', 'Traffic Funnel Summary')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p>• {applyVariables(t('pages.calculator.services.traffic.trafficInvestment', 'Traffic investment: {{amount}}'), { amount: formatCurrency(budgetValue) })}</p>
              <p>• {applyVariables(t('pages.calculator.services.traffic.trafficImpressions', '{{impressions}} impressions generated.'), { 
                impressions: formatNumber(results.impressions) 
              })}</p>
              <p>• {applyVariables(t('pages.calculator.services.traffic.trafficAdClicks', '{{clicks}} ad clicks achieved.'), { 
                clicks: formatNumber(results.adClicks) 
              })}</p>
              <p>• {applyVariables(t('pages.calculator.services.traffic.trafficWebsiteVisitors', '{{visitors}} website visitors.'), { 
                visitors: formatNumber(results.websiteVisitors) 
              })}</p>
              <p>• {applyVariables(t('pages.calculator.services.traffic.trafficCostPerClick', 'Cost per click: {{cost}}'), { 
                cost: formatCurrency(results.costPerClick) 
              })}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TrafficCalculator;

