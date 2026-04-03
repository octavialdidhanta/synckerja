import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { 
  BookOpen, 
  Target, 
  TrendingUp,
  CheckCircle,
  Lightbulb,
  Save,
  Upload,
  Users,
  DollarSign,
  BarChart3
} from 'lucide-react';

interface CalculatorTutorialProps {
  currentTab: string;
}

export const CalculatorTutorial: React.FC<CalculatorTutorialProps> = ({ currentTab }) => {
  const { t } = useAppTranslation();
  
  const renderServicesTutorial = () => (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/15 bg-brand-blue-soft p-3">
        <p className="text-sm text-brand-blue-on-soft">
          <strong>{t('pages.calculator.tutorial.objective', 'Objective:')}</strong> {t('pages.calculator.tutorial.services.objective', 'Calculate campaign performance for service businesses with separate calculators for Engagement, Traffic, and Conversion objectives.')}
        </p>
      </div>

      {/* Objective Engagement */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" />
            {t('pages.calculator.tutorial.services.engagement.title', 'Objective Engagement')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm">
            <p><strong>{t('pages.calculator.tutorial.services.engagement.description', 'Calculate branding campaign performance:')}</strong></p>
            <ul className="ml-2 list-inside list-disc space-y-1 text-muted-foreground">
              <li>{t('pages.calculator.tutorial.services.engagement.budget', 'Branding Budget (Rp): Total budget for branding campaign')}</li>
              <li>{t('pages.calculator.tutorial.services.engagement.cpm', 'CPM Branding (Rp): Cost per 1000 impressions')}</li>
              <li>{t('pages.calculator.tutorial.services.engagement.frequency', 'Average Frequency: Number of times audience sees the ad')}</li>
              <li>{t('pages.calculator.tutorial.services.engagement.rate', 'Engagement Rate (%): Percentage of audience that engages')}</li>
            </ul>
            <div className="mt-2 rounded border border-primary/15 bg-primary/5 p-2">
              <p className="text-xs text-brand-blue-on-soft">
                {t('pages.calculator.tutorial.services.engagement.tip', '💡 Tip: Engagement audience can be used as remarketing audience in Conversion calculator.')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Objective Traffic */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-primary" />
            {t('pages.calculator.tutorial.services.traffic.title', 'Objective Traffic')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm">
            <p><strong>{t('pages.calculator.tutorial.services.traffic.description', 'Calculate traffic campaign performance:')}</strong></p>
            <ul className="ml-2 list-inside list-disc space-y-1 text-muted-foreground">
              <li>{t('pages.calculator.tutorial.services.traffic.platform', 'Ad Platform: Choose Meta Ads (CPM) or Google Ads (CPC)')}</li>
              <li>{t('pages.calculator.tutorial.services.traffic.budget', 'Budget (Rp): Total traffic campaign budget')}</li>
              <li>{t('pages.calculator.tutorial.services.traffic.cpm', 'CPM (Rp): For Meta Ads - cost per 1000 impressions')}</li>
              <li>{t('pages.calculator.tutorial.services.traffic.cpc', 'CPC (Rp): For Google Ads - cost per click')}</li>
              <li>{t('pages.calculator.tutorial.services.traffic.ctr', 'CTR Link (%): Click-through rate')}</li>
              <li>{t('pages.calculator.tutorial.services.traffic.visit', 'Click to Visit Rate (%): Percentage that visits website')}</li>
            </ul>
            <div className="mt-2 rounded border border-primary/15 bg-brand-blue-soft/80 p-2">
              <p className="text-xs text-brand-blue-on-soft">
                {t('pages.calculator.tutorial.services.traffic.tip', '💡 Tip: Website visitors can be used as remarketing audience in Conversion calculator.')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Objective Conversion */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            {t('pages.calculator.tutorial.services.conversion.title', 'Objective Conversion')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm">
            <p><strong>{t('pages.calculator.tutorial.services.conversion.description', 'Calculate conversion campaign performance:')}</strong></p>
            <ul className="ml-2 list-inside list-disc space-y-1 text-muted-foreground">
              <li>{t('pages.calculator.tutorial.services.conversion.source', 'Remarketing Audience Source: Choose from Manual, Branding, or Traffic')}</li>
              <li>{t('pages.calculator.tutorial.services.conversion.frequency', 'Remarketing Frequency: Number of ad impressions per audience')}</li>
              <li>{t('pages.calculator.tutorial.services.conversion.rates', 'Conversion Rates: CTR, Visit, Form Submit, Prospect to Client')}</li>
              <li>{t('pages.calculator.tutorial.services.conversion.service', 'Service Package: Reservation and Cross-selling rates')}</li>
              <li>{t('pages.calculator.tutorial.services.conversion.metrics', 'Service Metrics: Package value, profit margin, retention rate')}</li>
            </ul>
            <div className="mt-2 rounded border border-primary/15 bg-success-muted p-2">
              <p className="text-xs text-success-foreground">
                {t('pages.calculator.tutorial.services.conversion.tip', '💡 Tip: Budget is automatically calculated from frequency, CPM, and remarketing audience.')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Template Management */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Save className="h-4 w-4 text-primary" />
            {t('pages.calculator.tutorial.services.template.title', 'Save & Load Template')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <Save className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p className="font-medium">{t('pages.calculator.tutorial.services.template.save', 'Save Template')}</p>
                <p className="text-xs text-muted-foreground">{t('pages.calculator.tutorial.services.template.saveDescription', 'Each calculator (Engagement, Traffic, Conversion) has its own Save Template button. Save settings separately for each objective.')}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Upload className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p className="font-medium">{t('pages.calculator.tutorial.services.template.load', 'Load Template')}</p>
                <p className="text-xs text-muted-foreground">{t('pages.calculator.tutorial.services.template.loadDescription', 'Load a previously saved template for the specific calculator. Templates are saved per calculator type.')}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-primary/15 bg-accent p-3">
            <div className="flex items-start gap-2">
              <Lightbulb className="mt-0.5 h-4 w-4 text-primary" />
              <div className="text-sm">
                <p className="font-medium text-foreground">{t('pages.calculator.tutorial.services.template.tips', 'Template Tips:')}</p>
                <p className="text-muted-foreground">
                  {t('pages.calculator.tutorial.services.template.tipsDescription', 'Create separate templates for each calculator. This allows you to mix and match different scenarios (e.g., high engagement + low traffic + high conversion).')}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Best Practices */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle className="h-4 w-4 text-primary" />
            {t('pages.calculator.tutorial.services.bestPractices.title', 'Best Practices')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border border-primary/15 bg-success-muted p-3">
            <h4 className="mb-1 text-sm font-medium text-success-foreground">{t('pages.calculator.tutorial.services.bestPractices.dos', 'What to Do')}</h4>
            <ul className="space-y-1 text-xs text-success-foreground">
              <li>{t('pages.calculator.tutorial.services.bestPractices.engagement', '• Start with Engagement calculator to build warm audience')}</li>
              <li>{t('pages.calculator.tutorial.services.bestPractices.traffic', '• Use Traffic calculator to drive website visitors')}</li>
              <li>{t('pages.calculator.tutorial.services.bestPractices.conversion', '• Use Conversion calculator with remarketing audience from Engagement or Traffic')}</li>
              <li>{t('pages.calculator.tutorial.services.bestPractices.template', '• Save templates for each calculator separately for flexibility')}</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderSalesTutorial = () => (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/15 bg-brand-blue-soft p-3">
        <p className="text-sm text-brand-blue-on-soft">
          <strong>{t('pages.calculator.tutorial.objective', 'Objective:')}</strong> {t('pages.calculator.tutorial.sales.objective', 'Calculate sales campaign performance with comprehensive funnel analysis, revenue projections, and optimization recommendations.')}
        </p>
      </div>

      {/* Sales Funnel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            {t('pages.calculator.tutorial.sales.salesFunnel.title', 'Sales Funnel')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm">
            <p><strong>{t('pages.calculator.tutorial.sales.salesFunnel.description', 'Track conversions through each stage:')}</strong></p>
            <ul className="ml-2 list-inside list-disc space-y-1 text-muted-foreground">
              <li>{t('pages.calculator.tutorial.sales.salesFunnel.clicks', 'Clicks: Total ad clicks from budget and CPC')}</li>
              <li>{t('pages.calculator.tutorial.sales.salesFunnel.productViews', 'Product Views: Visitors who view product pages')}</li>
              <li>{t('pages.calculator.tutorial.sales.salesFunnel.addToCart', 'Add to Cart: Visitors who add products to cart')}</li>
              <li>{t('pages.calculator.tutorial.sales.salesFunnel.checkout', 'Checkout: Customers who start checkout process')}</li>
              <li>{t('pages.calculator.tutorial.sales.salesFunnel.orders', 'Orders: Successful completed orders')}</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Marketing KPIs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-primary" />
            {t('pages.calculator.tutorial.sales.marketingKPI.title', 'Marketing KPIs')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm">
            <p><strong>{t('pages.calculator.tutorial.sales.marketingKPI.description', 'Set your campaign parameters:')}</strong></p>
            <ul className="ml-2 list-inside list-disc space-y-1 text-muted-foreground">
              <li>{t('pages.calculator.tutorial.sales.marketingKPI.budget', 'Budget (Rp): Total campaign budget')}</li>
              <li>{t('pages.calculator.tutorial.sales.marketingKPI.cpc', 'CPC (Rp): Cost per click')}</li>
              <li>{t('pages.calculator.tutorial.sales.marketingKPI.ctr', 'Landing Page CTR (%): Click-through rate to product pages')}</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Conversion Rates */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" />
            {t('pages.calculator.tutorial.sales.conversionRates.title', 'Conversion Rates')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm">
            <p><strong>{t('pages.calculator.tutorial.sales.conversionRates.description', 'Define conversion rates at each stage:')}</strong></p>
            <ul className="ml-2 list-inside list-disc space-y-1 text-muted-foreground">
              <li>{t('pages.calculator.tutorial.sales.conversionRates.productView', 'Product View Rate: Landing to product view conversion')}</li>
              <li>{t('pages.calculator.tutorial.sales.conversionRates.addToCart', 'Add to Cart Rate: Product view to cart conversion')}</li>
              <li>{t('pages.calculator.tutorial.sales.conversionRates.checkout', 'Checkout Rate: Cart to checkout conversion')}</li>
              <li>{t('pages.calculator.tutorial.sales.conversionRates.payment', 'Payment Success Rate: Checkout to payment success')}</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Metrics */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4 text-primary" />
            {t('pages.calculator.tutorial.sales.revenueMetrics.title', 'Revenue Metrics')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm">
            <p><strong>{t('pages.calculator.tutorial.sales.revenueMetrics.description', 'Set product and revenue parameters:')}</strong></p>
            <ul className="ml-2 list-inside list-disc space-y-1 text-muted-foreground">
              <li>{t('pages.calculator.tutorial.sales.revenueMetrics.productPrice', 'Product Price (Rp): Individual product price')}</li>
              <li>{t('pages.calculator.tutorial.sales.revenueMetrics.avgOrderValue', 'Average Order Value (Rp): Average revenue per order')}</li>
              <li>{t('pages.calculator.tutorial.sales.revenueMetrics.profitMargin', 'Profit Margin (%): Profit percentage per order')}</li>
              <li>{t('pages.calculator.tutorial.sales.revenueMetrics.seasonal', 'Seasonal Multiplier: Adjust for seasonal variations')}</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Metrics */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" />
            {t('pages.calculator.tutorial.sales.advancedMetrics.title', 'Advanced Metrics')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm">
            <p><strong>{t('pages.calculator.tutorial.sales.advancedMetrics.description', 'Customer behavior and lifetime value:')}</strong></p>
            <ul className="ml-2 list-inside list-disc space-y-1 text-muted-foreground">
              <li>{t('pages.calculator.tutorial.sales.advancedMetrics.repeatPurchase', 'Repeat Purchase Rate: Percentage of customers who buy again')}</li>
              <li>{t('pages.calculator.tutorial.sales.advancedMetrics.upsell', 'Upsell Rate: Additional sales from existing customers')}</li>
              <li>{t('pages.calculator.tutorial.sales.advancedMetrics.clv', 'Customer Lifetime Value: Total value over customer lifetime')}</li>
              <li>{t('pages.calculator.tutorial.sales.advancedMetrics.clvCac', 'CLV/CAC Ratio: Lifetime value vs acquisition cost')}</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Template Management */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Save className="h-4 w-4 text-primary" />
            {t('pages.calculator.tutorial.sales.template.title', 'Save & Load Template')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <Save className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p className="font-medium">{t('pages.calculator.tutorial.sales.template.save', 'Save Template')}</p>
                <p className="text-xs text-muted-foreground">{t('pages.calculator.tutorial.sales.template.saveDescription', 'Save your sales campaign settings for future use.')}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Upload className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p className="font-medium">{t('pages.calculator.tutorial.sales.template.load', 'Load Template')}</p>
                <p className="text-xs text-muted-foreground">{t('pages.calculator.tutorial.sales.template.loadDescription', 'Load a previously saved sales campaign template.')}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Best Practices */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle className="h-4 w-4 text-primary" />
            {t('pages.calculator.tutorial.sales.bestPractices.title', 'Best Practices')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border border-primary/15 bg-success-muted p-3">
            <h4 className="mb-1 text-sm font-medium text-success-foreground">{t('pages.calculator.tutorial.sales.bestPractices.dos', 'What to Do')}</h4>
            <ul className="space-y-1 text-xs text-success-foreground">
              <li>{t('pages.calculator.tutorial.sales.bestPractices.optimize', '• Optimize conversion rates at each funnel stage')}</li>
              <li>{t('pages.calculator.tutorial.sales.bestPractices.monitor', '• Monitor ROAS and CLV/CAC ratio for profitability')}</li>
              <li>{t('pages.calculator.tutorial.sales.bestPractices.test', '• Test different product prices and profit margins')}</li>
              <li>{t('pages.calculator.tutorial.sales.bestPractices.retention', '• Focus on repeat purchase and upsell rates for growth')}</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-primary/10 pb-2">
        <BookOpen className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">
          {t('pages.calculator.tutorial.title', 'Calculator Tutorial')}
        </h3>
      </div>
      {currentTab === 'services' ? renderServicesTutorial() : renderSalesTutorial()}
    </div>
  );
};

