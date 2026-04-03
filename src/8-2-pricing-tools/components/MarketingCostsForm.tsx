import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group';
import { Badge } from '@/shared/components/ui/badge';
import { Separator } from '@/shared/components/ui/separator';
import { TrendingUp, AlertTriangle, Calculator, GitCompare } from 'lucide-react';
import { formatRupiah, formatNumber, formatInputNumber, parseInputNumber, calculateRecommendedMarketingSpend, calculateFinalUnitsWithMarketingSpend } from '../lib/pricingUtils';
import { PricingCalculationResult, CostAllocationMethod } from '../types/pricingTypes';

interface MarketingCostsFormProps {
  baseSellingPrice: number; // Base selling price dari Step 5 (Pricing Settings)
  baseCalculationResult?: PricingCalculationResult | null; // Preliminary results dari Step 5
  onMarketingChange?: (marketingSpend: number, targetROAS: number, marketingCostPerUnit: number) => void;
  initialMarketingSpend?: number;
  initialTargetROAS?: number;
  timePeriod?: 'monthly' | 'yearly';
  operationalExpenses?: number; // Untuk calculate final units
  costAllocationMethod?: CostAllocationMethod; // Untuk calculate final units
  channelFeePercent?: number; // Untuk calculate final units
  baseTotalCostPerUnit?: number; // Production + Operational cost per unit
}

// Helper function untuk format currency
const formatCurrency = (value: number): string => {
  return value.toLocaleString('id-ID', { 
    minimumFractionDigits: 0,
    maximumFractionDigits: 2 
  });
};

export const MarketingCostsForm = ({
  baseSellingPrice,
  baseCalculationResult,
  onMarketingChange,
  initialMarketingSpend,
  initialTargetROAS,
  timePeriod = 'monthly',
  operationalExpenses = 0,
  costAllocationMethod = 'fixed-cost',
  channelFeePercent = 0,
  baseTotalCostPerUnit = 0,
}: MarketingCostsFormProps) => {
  const [marketingSpend, setMarketingSpend] = useState<number>(initialMarketingSpend || 0);
  const [marketingSpendDisplay, setMarketingSpendDisplay] = useState<string>(
    initialMarketingSpend ? formatInputNumber(Math.round(initialMarketingSpend)) : ''
  );
  const [targetROAS, setTargetROAS] = useState<number>(initialTargetROAS !== undefined ? initialTargetROAS : 0);
  const [calculationMethod, setCalculationMethod] = useState<'roas' | 'flat-rate' | 'manual'>('roas');
  const [flatRate, setFlatRate] = useState<number>(0);
  const [flatRateDisplay, setFlatRateDisplay] = useState<string>('');
  const [flatRateUnits, setFlatRateUnits] = useState<number>(0);
  const [manualCostPerUnit, setManualCostPerUnit] = useState<number>(0);
  const [manualCostPerUnitDisplay, setManualCostPerUnitDisplay] = useState<string>('');

  // Calculate marketing cost per unit based on method
  // Untuk ROAS method, gunakan iterasi dengan expected revenue untuk akurasi
  const calculateMarketingCostPerUnit = (): number => {
    if (calculationMethod === 'roas') {
      if (marketingSpend > 0 && targetROAS > 0 && baseSellingPrice > 0) {
        // Calculate expected revenue dari ROAS
        const expectedRevenue = marketingSpend * targetROAS;
        
        // Untuk ROAS method, kita perlu iterasi karena:
        // - Marketing cost per unit = marketingSpend / units sold
        // - Units sold = expectedRevenue / finalSellingPrice
        // - Final selling price = baseSellingPrice + marketing cost per unit
        // Ini adalah circular dependency yang perlu dipecahkan dengan iterasi
        
        // Mulai dengan estimasi awal menggunakan baseSellingPrice
        let estimatedUnitsSold = expectedRevenue / baseSellingPrice;
        let marketingCostPerUnit = 0;
        let finalSellingPrice = baseSellingPrice;
        
        // Iterasi untuk konvergen (max 10 kali)
        for (let i = 0; i < 10; i++) {
          if (estimatedUnitsSold <= 0) break;
          
          // Hitung marketing cost per unit berdasarkan units saat ini
          marketingCostPerUnit = marketingSpend / estimatedUnitsSold;
          
          // Final selling price = base + marketing cost per unit
          finalSellingPrice = baseSellingPrice + marketingCostPerUnit;
          
          // Hitung ulang units sold berdasarkan final selling price
          const newEstimatedUnitsSold = finalSellingPrice > 0 ? expectedRevenue / finalSellingPrice : 0;
          
          // Cek konvergen (perbedaan < 0.01 unit)
          if (Math.abs(newEstimatedUnitsSold - estimatedUnitsSold) < 0.01) {
            estimatedUnitsSold = newEstimatedUnitsSold;
            break;
          }
          
          estimatedUnitsSold = newEstimatedUnitsSold;
        }
        
        // Return marketing cost per unit yang sudah konvergen
        if (estimatedUnitsSold > 0) {
          return Math.round((marketingSpend / estimatedUnitsSold) * 100) / 100;
        }
      }
      return 0;
    } else if (calculationMethod === 'flat-rate') {
      if (flatRate > 0 && flatRateUnits > 0) {
        // Round to 2 decimal places
        return Math.round((flatRate / flatRateUnits) * 100) / 100;
      }
      return 0;
    } else if (calculationMethod === 'manual') {
      return manualCostPerUnit || 0;
    }
    return 0;
  };

  // Calculate marketing cost per unit - akan otomatis recalculate ketika targetROAS berubah
  const marketingCostPerUnit = useMemo(() => {
    return calculateMarketingCostPerUnit();
  }, [calculationMethod, marketingSpend, targetROAS, baseSellingPrice, baseCalculationResult, baseTotalCostPerUnit, operationalExpenses, channelFeePercent, costAllocationMethod, flatRate, flatRateUnits, manualCostPerUnit]);
  
  // Final selling price - akan otomatis recalculate ketika marketingCostPerUnit berubah
  const finalSellingPrice = useMemo(() => {
    return baseSellingPrice + marketingCostPerUnit;
  }, [baseSellingPrice, marketingCostPerUnit]);

  // Calculate expected revenue and units sold for ROAS method
  const expectedRevenue = marketingSpend > 0 && targetROAS > 0 
    ? marketingSpend * targetROAS 
    : 0;
  const estimatedUnitsSold = baseSellingPrice > 0 && expectedRevenue > 0
    ? expectedRevenue / baseSellingPrice
    : 0;
  // Calculate units that should be sold based on final selling price (after marketing)
  const estimatedUnitsSoldFinal = finalSellingPrice > 0 && expectedRevenue > 0
    ? expectedRevenue / finalSellingPrice
    : 0;

  // Calculate final units required after marketing (with circular dependency handling)
  // Untuk ROAS method, gunakan marketingCostPerUnit dan finalSellingPrice yang sudah ter-update
  // Untuk flat-rate dan manual, gunakan perhitungan langsung
  const calculateFinalUnitsRequired = (): {
    breakEvenUnitsBefore: number;
    breakEvenUnitsAfter: number;
    targetProfitUnitsBefore: number;
    targetProfitUnitsAfter: number;
  } | null => {
    if (!baseCalculationResult || baseTotalCostPerUnit <= 0 || marketingCostPerUnit <= 0) {
      return null;
    }

    const breakEvenUnitsBefore = baseCalculationResult.breakEven.unitsRequired;
    const targetProfitUnitsBefore = baseCalculationResult.targetProfit?.unitsRequired || 0;

    let breakEvenUnitsAfter = breakEvenUnitsBefore;
    let targetProfitUnitsAfter = targetProfitUnitsBefore;

    // Final total cost per unit (with marketing)
    const finalTotalCostPerUnit = baseTotalCostPerUnit + marketingCostPerUnit;
    
    // Channel fee per unit (based on final selling price)
    const channelFeePerUnit = (finalSellingPrice * channelFeePercent) / 100;
    
    // Net profit per unit after marketing (LOWER because cost increased)
    const netProfitPerUnit = finalSellingPrice - finalTotalCostPerUnit - channelFeePerUnit;

    if (netProfitPerUnit <= 0) {
      return null;
    }

    // Untuk semua metode (ROAS, flat-rate, manual), gunakan perhitungan langsung dengan marketingCostPerUnit dan finalSellingPrice yang sudah ter-update
    if (costAllocationMethod === 'fixed-cost') {
      // Fixed-cost: break-even untuk menutupi operational expenses
      breakEvenUnitsAfter = Math.ceil(operationalExpenses / netProfitPerUnit);
      
      // For target profit, need to recalculate
      if (baseCalculationResult.targetProfit && baseCalculationResult.targetProfit.unitsRequired > 0) {
        const targetProfitAmount = baseCalculationResult.targetProfit.targetProfitAmount || 0;
        const totalNeeded = operationalExpenses + targetProfitAmount;
        targetProfitUnitsAfter = Math.ceil(totalNeeded / netProfitPerUnit);
      }
    } else {
      // Per-unit method: more complex, simplified for now
      breakEvenUnitsAfter = breakEvenUnitsBefore; // Simplified
      targetProfitUnitsAfter = targetProfitUnitsBefore; // Simplified
    }

    return {
      breakEvenUnitsBefore,
      breakEvenUnitsAfter,
      targetProfitUnitsBefore,
      targetProfitUnitsAfter,
    };
  };

  // Calculate final units required - akan otomatis recalculate ketika targetROAS atau marketingSpend berubah
  const finalUnitsData = useMemo(() => {
    return calculateFinalUnitsRequired();
  }, [baseCalculationResult, baseTotalCostPerUnit, calculationMethod, marketingSpend, targetROAS, marketingCostPerUnit, finalSellingPrice, operationalExpenses, channelFeePercent, costAllocationMethod]);

  // Update display values when initial values change
  useEffect(() => {
    if (initialMarketingSpend) {
      const roundedValue = Math.round(initialMarketingSpend);
      setMarketingSpend(roundedValue);
      setMarketingSpendDisplay(formatInputNumber(roundedValue));
    } else {
      setMarketingSpend(0);
      setMarketingSpendDisplay('');
    }
    if (initialTargetROAS !== undefined) {
      setTargetROAS(initialTargetROAS);
    }
  }, [initialMarketingSpend, initialTargetROAS]);

  // Notify parent when marketing data changes
  useEffect(() => {
    if (onMarketingChange) {
      const costPerUnit = calculateMarketingCostPerUnit();
      onMarketingChange(marketingSpend, targetROAS, costPerUnit);
    }
  }, [marketingSpend, targetROAS, calculationMethod, flatRate, flatRateUnits, manualCostPerUnit, baseSellingPrice, baseCalculationResult, baseTotalCostPerUnit, operationalExpenses, channelFeePercent, costAllocationMethod]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-primary" />
          Marketing Costs
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Display Base Selling Price */}
        <div className="bg-brand-blue-soft p-3 rounded-lg border border-brand-blue/25">
          <div className="flex justify-between items-center">
            <span className="text-sm text-foreground">Base Selling Price:</span>
            <span className="text-lg font-bold text-brand-blue-deep">
              {formatRupiah(baseSellingPrice)}
            </span>
          </div>
        </div>

        {/* Layout: Metode Perhitungan (Kiri) | Marketing Spend Input (Kanan) */}
        <div className="grid grid-cols-2 gap-4">
          {/* Calculation Method Selection - Left Column */}
          <div className="bg-muted/50 p-3 rounded-lg border border-border">
            <Label className="text-sm font-semibold text-foreground mb-2 block">
              Metode Perhitungan:
            </Label>
            <RadioGroup
              value={calculationMethod}
              onValueChange={(value) => {
                setCalculationMethod(value as 'roas' | 'flat-rate' | 'manual');
                if (value === 'roas') {
                  setFlatRate(0);
                  setFlatRateDisplay('');
                  setFlatRateUnits(0);
                  setManualCostPerUnit(0);
                  setManualCostPerUnitDisplay('');
                } else if (value === 'flat-rate') {
                  setMarketingSpend(0);
                  setMarketingSpendDisplay('');
                  setTargetROAS(3);
                  setManualCostPerUnit(0);
                  setManualCostPerUnitDisplay('');
                } else if (value === 'manual') {
                  setMarketingSpend(0);
                  setMarketingSpendDisplay('');
                  setTargetROAS(3);
                  setFlatRate(0);
                  setFlatRateDisplay('');
                  setFlatRateUnits(0);
                }
              }}
              className="space-y-2"
            >
              <div className="flex items-center space-x-2 p-2 border rounded-lg bg-white">
                <RadioGroupItem value="roas" id="roas" />
                <Label htmlFor="roas" className="text-sm cursor-pointer">ROAS-based</Label>
              </div>
              <div className="flex items-center space-x-2 p-2 border rounded-lg bg-white">
                <RadioGroupItem value="flat-rate" id="flat-rate" />
                <Label htmlFor="flat-rate" className="text-sm cursor-pointer">Flat Rate</Label>
              </div>
              <div className="flex items-center space-x-2 p-2 border rounded-lg bg-white">
                <RadioGroupItem value="manual" id="manual" />
                <Label htmlFor="manual" className="text-sm cursor-pointer">Manual</Label>
              </div>
            </RadioGroup>
          </div>

          {/* ROAS-based Calculation - Right Column */}
          {calculationMethod === 'roas' && (
            <div className="p-4 bg-primary/10 border border-primary/25 rounded-lg space-y-3">
              <div>
                <Label className="text-sm text-foreground">Marketing Spend ({timePeriod === 'monthly' ? 'per bulan' : 'per tahun'})</Label>
                <Input
                  type="text"
                  placeholder="5.000.000"
                  value={marketingSpendDisplay}
                  onChange={(e) => {
                    const rawValue = e.target.value;
                    setMarketingSpendDisplay(rawValue);
                    const parsedValue = parseInputNumber(rawValue);
                    setMarketingSpend(parsedValue);
                  }}
                  onBlur={(e) => {
                    const parsedValue = parseInputNumber(e.target.value);
                    const roundedValue = Math.round(parsedValue);
                    setMarketingSpend(roundedValue);
                    setMarketingSpendDisplay(formatInputNumber(roundedValue));
                  }}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label className="text-sm text-foreground">Target ROAS</Label>
                <Input
                  type="number"
                  placeholder="0"
                  step="0.1"
                  value={targetROAS || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || value === '0') {
                      setTargetROAS(0);
                    } else {
                      const numValue = parseFloat(value);
                      if (!isNaN(numValue) && numValue >= 0) {
                        setTargetROAS(numValue);
                      }
                    }
                  }}
                  className="mt-1"
                  min="0"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {targetROAS > 0 
                    ? `ROAS ${targetROAS}:1 = setiap Rp 1 spend menghasilkan Rp ${targetROAS} revenue`
                    : 'ROAS 0 berarti tidak menggunakan ROAS untuk perhitungan marketing'}
                </p>
              </div>
              
              {/* Results */}
              {marketingSpend > 0 && targetROAS > 0 && baseSellingPrice > 0 && (
                <div className="overflow-x-auto mt-3">
                  <div className="grid grid-cols-4 gap-3 p-3 bg-white border border-primary/25 rounded min-w-[800px]">
                    <div className="min-w-[180px]">
                      <div className="text-xs text-muted-foreground">Marketing Cost per Unit</div>
                      <div className="text-lg font-semibold text-primary mt-1">
                        {formatRupiah(marketingCostPerUnit)}
                      </div>
                    </div>
                    <div className="min-w-[180px]">
                      <div className="text-xs text-muted-foreground">Final Selling Price</div>
                      <div className="text-lg font-semibold text-brand-blue-deep mt-1 flex items-center gap-1">
                        {formatRupiah(finalSellingPrice)}
                        <span className="text-sm text-muted-foreground font-normal">unit</span>
                      </div>
                    </div>
                    <div className="min-w-[180px]">
                      <div className="text-xs text-muted-foreground">Units to Sell</div>
                      <div className="text-lg font-semibold text-brand-blue-deep mt-1">
                        {estimatedUnitsSoldFinal > 0 ? formatNumber(Math.round(estimatedUnitsSoldFinal)) : '-'} unit
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        (for ROAS target)
                      </div>
                    </div>
                    <div className="min-w-[180px]">
                      <div className="text-xs text-muted-foreground">Expected Revenue</div>
                      <div className="text-lg font-semibold text-brand-blue-on-soft mt-1">
                        {formatRupiah(expectedRevenue)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Flat Rate Calculation - Right Column */}
          {calculationMethod === 'flat-rate' && (
            <div className="p-4 bg-muted/50 border border-border rounded-lg space-y-3">
              <div>
                <Label className="text-sm text-foreground">Total Marketing Cost</Label>
                <Input
                  type="text"
                  placeholder="5.000.000"
                  value={flatRateDisplay}
                  onChange={(e) => {
                    const rawValue = e.target.value;
                    setFlatRateDisplay(rawValue);
                    const parsedValue = parseInputNumber(rawValue);
                    setFlatRate(parsedValue);
                  }}
                  onBlur={(e) => {
                    const parsedValue = parseInputNumber(e.target.value);
                    const roundedValue = Math.round(parsedValue);
                    setFlatRate(roundedValue);
                    setFlatRateDisplay(formatInputNumber(roundedValue));
                  }}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label className="text-sm text-foreground">Jumlah Unit</Label>
                <Input
                  type="number"
                  placeholder="1000"
                  value={flatRateUnits || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFlatRateUnits(value === '' ? 0 : parseFloat(value) || 0);
                  }}
                  className="mt-1"
                />
              </div>
              
              {flatRate > 0 && flatRateUnits > 0 && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-white border border-border rounded mt-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Marketing Cost per Unit</div>
                    <div className="text-lg font-semibold text-foreground mt-1">
                      {formatRupiah(marketingCostPerUnit)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Final Selling Price</div>
                    <div className="text-lg font-semibold text-brand-blue-deep mt-1">
                      {formatRupiah(finalSellingPrice)} <span className="text-sm text-muted-foreground">unit</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Manual Calculation - Right Column */}
          {calculationMethod === 'manual' && (
            <div className="p-4 bg-muted/50 border border-border rounded-lg space-y-3">
              <div>
                <Label className="text-sm text-foreground">Marketing Cost per Unit</Label>
                <Input
                  type="text"
                  placeholder="6.000"
                  value={manualCostPerUnitDisplay}
                  onChange={(e) => {
                    const rawValue = e.target.value;
                    setManualCostPerUnitDisplay(rawValue);
                    const parsedValue = parseInputNumber(rawValue);
                    setManualCostPerUnit(parsedValue);
                  }}
                  onBlur={(e) => {
                    const parsedValue = parseInputNumber(e.target.value);
                    const roundedValue = Math.round(parsedValue);
                    setManualCostPerUnit(roundedValue);
                    setManualCostPerUnitDisplay(formatInputNumber(roundedValue));
                  }}
                  className="mt-1"
                />
              </div>
              
              {manualCostPerUnit > 0 && (
                <div className="p-3 bg-white border border-border rounded">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-foreground">Final Selling Price:</span>
                    <span className="text-lg font-bold text-brand-blue-deep">
                      {formatRupiah(finalSellingPrice)} <span className="text-sm text-muted-foreground">unit</span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Summary and Comparison - Side by Side */}
        {marketingCostPerUnit > 0 && (
          <div className="grid grid-cols-2 gap-4">
            {/* Summary - Left Column */}
            <Card className="border-brand-blue/35 bg-brand-blue-soft">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-brand-blue-on-soft" />
                  Hasil Akhir
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-foreground">Base Selling Price:</span>
                  <span className="font-semibold">{formatRupiah(baseSellingPrice)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-foreground">Marketing Cost per Unit:</span>
                  <span className="font-semibold text-brand-red">+ {formatRupiah(marketingCostPerUnit)}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-brand-blue-deep">Final Selling Price:</span>
                  <span className="text-lg font-bold text-brand-blue-deep">{formatRupiah(finalSellingPrice)} <span className="text-sm text-muted-foreground">unit</span></span>
                </div>
              </CardContent>
            </Card>

            {/* Comparison View: Before vs After Marketing - Right Column */}
            {finalUnitsData && (
              <Card className="border-brand-blue/35 bg-brand-blue-soft">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-brand-blue-on-soft" />
                    Perbandingan: Sebelum vs Setelah Marketing
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* ROAS Target Comparison */}
                  {calculationMethod === 'roas' && estimatedUnitsSoldFinal > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white p-3 rounded-lg border border-border">
                        <div className="text-xs text-muted-foreground mb-1">Units for ROAS Target</div>
                        <div className="text-sm font-semibold">{formatNumber(Math.round(estimatedUnitsSoldFinal))} unit</div>
                      </div>
                      <div className="bg-brand-blue-soft p-3 rounded-lg border-2 border-brand-blue/35">
                        <div className="text-xs text-brand-blue-deep mb-1">Expected Revenue</div>
                        <div className="text-sm font-semibold text-brand-blue-deep">
                          {formatRupiah(expectedRevenue)}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Break-Even Comparison */}
                  {finalUnitsData && finalUnitsData.breakEvenUnitsBefore > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white p-3 rounded-lg border border-border">
                        <div className="text-xs text-muted-foreground mb-1">Break-Even (Before)</div>
                        <div className="text-sm font-semibold">{formatNumber(finalUnitsData.breakEvenUnitsBefore)} unit</div>
                      </div>
                      <div className="bg-brand-blue-soft p-3 rounded-lg border-2 border-brand-blue/35">
                        <div className="text-xs text-brand-blue-deep mb-1">Break-Even (After)</div>
                        <div className="text-sm font-semibold text-brand-blue-deep">
                          {formatNumber(finalUnitsData.breakEvenUnitsAfter)} unit
                          <span className="text-xs ml-1">
                            (+{((finalUnitsData.breakEvenUnitsAfter - finalUnitsData.breakEvenUnitsBefore) / finalUnitsData.breakEvenUnitsBefore * 100).toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Target Profit Comparison */}
                  {finalUnitsData && finalUnitsData.targetProfitUnitsBefore > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white p-3 rounded-lg border border-border">
                        <div className="text-xs text-muted-foreground mb-1">Target Profit (Before)</div>
                        <div className="text-sm font-semibold">{formatNumber(finalUnitsData.targetProfitUnitsBefore)} unit</div>
                      </div>
                      <div className="bg-brand-blue-soft p-3 rounded-lg border-2 border-brand-blue/35">
                        <div className="text-xs text-brand-blue-deep mb-1">Units for ROAS Target</div>
                        <div className="text-sm font-semibold text-brand-blue-deep">
                          {calculationMethod === 'roas' && estimatedUnitsSoldFinal > 0 
                            ? formatNumber(Math.round(estimatedUnitsSoldFinal)) 
                            : formatNumber(finalUnitsData.targetProfitUnitsAfter)} unit
                          {calculationMethod === 'roas' && estimatedUnitsSoldFinal > 0 && (
                            <span className="text-xs ml-1">
                              (ROAS: {targetROAS}:1)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Warning if marketing cost is too high */}
        {marketingCostPerUnit > 0 && baseSellingPrice > 0 && (marketingCostPerUnit / baseSellingPrice) > 0.3 && (
          <div className="rounded-lg border-2 border-brand-red/30 bg-brand-red/5 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-brand-red" />
              <div>
                <p className="mb-1 font-semibold text-brand-red">Warning: High Marketing Cost</p>
                <p className="text-sm text-brand-red/90">
                  Marketing cost ({((marketingCostPerUnit / baseSellingPrice) * 100).toFixed(1)}% dari base selling price) 
                  terlihat cukup tinggi. Pastikan ini sesuai dengan strategi marketing Anda.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

