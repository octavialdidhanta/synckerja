import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { AlertTriangle, TrendingUp, Target } from 'lucide-react';
import { Separator } from '@/shared/components/ui/separator';
import { PricingCalculationResult, TimePeriod } from '../types/pricingTypes';
import { formatRupiah, formatNumber, MarketingRecommendation } from '../lib/pricingUtils';

interface TargetCalculationResultsProps {
  results: PricingCalculationResult;
  timePeriod: TimePeriod;
  breakEvenRecommendation?: MarketingRecommendation | null;
  targetProfitRecommendation?: MarketingRecommendation | null;
  targetROAS?: number;
  isPreliminary?: boolean;
  currentStep?: number;
  targetProfitPercent?: number;
}

export const TargetCalculationResults = ({ 
  results, 
  timePeriod,
  breakEvenRecommendation,
  targetProfitRecommendation,
  targetROAS,
  isPreliminary = false,
  currentStep = 1,
  targetProfitPercent,
}: TargetCalculationResultsProps) => {
  const { breakEven, targetProfit, warnings, summary } = results;

  return (
    <div className="space-y-4">
      {/* Warnings */}
      {warnings.lowMargin && (
        <Card className="border-brand-red/25 bg-brand-red/5">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-brand-red" />
              <div className="flex-1">
                <p className="mb-1 font-medium text-brand-red">Low Margin Warning</p>
                <p className="text-sm text-brand-red/90">{warnings.lowMarginMessage}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {warnings.unrealisticTarget && (
        <Card className="border-brand-red/30 bg-brand-red/10">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-brand-red" />
              <div className="flex-1">
                <p className="mb-1 font-medium text-brand-red">Unrealistic Target</p>
                <p className="text-sm text-brand-red/90">{warnings.unrealisticTarget}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Break-Even Analysis - Simplified */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Target className="h-4 w-4 text-brand-blue" />
            Break-Even Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-brand-blue/25 bg-brand-blue-soft p-4">
              <div className="mb-1 text-xs text-brand-blue-deep">Units Required</div>
              <p className="text-xl font-bold text-brand-blue-deep">
                {breakEven.unitsRequired === Infinity ? '∞' : formatNumber(breakEven.unitsRequired)}
              </p>
              <p className="mt-1 text-xs text-brand-blue-on-soft">
                {timePeriod === 'monthly' ? 'unit/bulan' : 'unit/tahun'}
              </p>
            </div>

            <div className="rounded-lg border border-primary/25 bg-primary/10 p-4">
              <div className="mb-1 text-xs text-primary">Revenue Required</div>
              <p className="text-xl font-bold text-primary">
                {breakEven.revenueRequired === Infinity ? '∞' : formatRupiah(breakEven.revenueRequired)}
              </p>
              <p className="mt-1 text-xs text-primary/80">
                {timePeriod === 'monthly' ? 'target/bulan' : 'target/tahun'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Target Profit Analysis - Simplified */}
      {targetProfit && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-primary" />
              Target Profit Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-primary/25 bg-primary/10 p-4">
                <div className="mb-1 text-xs text-primary">Units Required</div>
                <p className="text-xl font-bold text-primary">
                  {targetProfit.unitsRequired === Infinity ? '∞' : formatNumber(targetProfit.unitsRequired)}
                </p>
                <p className="mt-1 text-xs text-primary/80">
                  {timePeriod === 'monthly' ? 'unit/bulan' : 'unit/tahun'}
                </p>
              </div>

              <div className="rounded-lg border border-primary/25 bg-primary/10 p-4">
                <div className="mb-1 text-xs text-primary">Revenue Required</div>
                <p className="text-xl font-bold text-primary">
                  {targetProfit.revenueRequired === Infinity ? '∞' : formatRupiah(targetProfit.revenueRequired)}
                </p>
                <p className="mt-1 text-xs text-primary/80">
                  {timePeriod === 'monthly' ? 'target/bulan' : 'target/tahun'}
                </p>
                {/* Breakdown Detail - Simplified */}
                {targetProfitPercent && targetProfitPercent > 0 && (
                  <div className="mt-3 space-y-1 border-t border-primary/20 pt-3">
                    <div className="text-xs text-muted-foreground">
                      Breakdown:
                    </div>
                    <div className="space-y-0.5 pl-2 text-xs text-muted-foreground">
                      <div>Production Cost: {formatRupiah(targetProfit.productionCost)}</div>
                      <div>+ Operational Cost: {formatRupiah(targetProfit.operationalCost)}</div>
                      {targetProfit.channelFee > 0 && (
                        <div>+ Channel Fee: {formatRupiah(targetProfit.channelFee)}</div>
                      )}
                    </div>
                    <div className="pl-2 pt-1 text-xs text-muted-foreground">
                      + Target Profit ({targetProfitPercent}%): {formatRupiah(targetProfit.targetProfitAmount)}
                    </div>
                    <div className="pt-1 text-xs font-medium text-primary">
                      = Revenue Required: {formatRupiah(targetProfit.revenueRequired)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary - Simplified - Hide on step 6 (Final Summary) */}
      {currentStep !== 6 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Total Cost per Unit:</span>
              <span className="text-lg font-bold">{formatRupiah(results.totalCostPerUnit)}</span>
            </div>

            {summary.netProfitPerUnit !== undefined && (
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">Net Profit per Unit:</span>
                <span className="font-semibold text-brand-blue-deep">{formatRupiah(summary.netProfitPerUnit)}</span>
              </div>
            )}

            <Separator />

            <div className="rounded-lg border border-brand-blue/25 bg-brand-blue-soft p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-brand-blue-deep">Selling Price:</span>
                <span className="text-lg font-bold text-brand-blue-deep">
                  {formatRupiah(summary.recommendedSellingPrice)}
                </span>
              </div>
              {summary.recommendedChannel && (
                <p className="mt-1 text-xs text-brand-blue-on-soft">
                  Best margin: <strong>{summary.recommendedChannel}</strong>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
