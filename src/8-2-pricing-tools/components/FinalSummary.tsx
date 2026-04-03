import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Separator } from '@/shared/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { FileText, TrendingUp, DollarSign, Package, Calculator, Info } from 'lucide-react';
import { PricingCalculationResult, TimePeriod } from '../types/pricingTypes';
import { formatRupiah, formatNumber } from '../lib/pricingUtils';
import { calculateFinalUnitsWithMarketingSpend } from '../lib/pricingUtils';

interface FinalSummaryProps {
  preliminaryResult: PricingCalculationResult | null;
  marketingSpend: number;
  targetROAS: number;
  marketingCostPerUnit: number;
  finalSellingPrice: number;
  operationalExpenses: number;
  costAllocationMethod: 'fixed-cost' | 'per-unit';
  channelFeePercent: number;
  baseTotalCostPerUnit: number;
  timePeriod: TimePeriod;
  // Pricing Settings from Step 5
  calculationMethod?: 'markup' | 'margin' | 'fixed';
  markupPercent?: number;
  marginPercent?: number;
  fixedProfit?: number;
  targetProfitPercent?: number;
  minimumMarginPercent?: number;
  productName?: string;
  category?: string;
}

export const FinalSummary = ({
  preliminaryResult,
  marketingSpend,
  targetROAS,
  marketingCostPerUnit,
  finalSellingPrice,
  operationalExpenses,
  costAllocationMethod,
  channelFeePercent,
  baseTotalCostPerUnit,
  timePeriod,
  calculationMethod,
  markupPercent,
  marginPercent,
  fixedProfit,
  targetProfitPercent,
  minimumMarginPercent,
  productName,
  category,
}: FinalSummaryProps) => {
  if (!preliminaryResult) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8 text-muted-foreground">
            Silakan selesaikan Step 5 (Pricing Settings) dan Step 6 (Marketing Costs) terlebih dahulu.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate final units with marketing
  const breakEvenUnitsBefore = preliminaryResult.breakEven.unitsRequired;
  const targetProfitUnitsBefore = preliminaryResult.targetProfit?.unitsRequired || 0;
  const targetProfitAmount = preliminaryResult.targetProfit?.targetProfitAmount || 0;

  let breakEvenUnitsAfter = breakEvenUnitsBefore;
  let targetProfitUnitsAfter = targetProfitUnitsBefore;
  let finalMarketingCostPerUnit = marketingCostPerUnit;
  let finalSellingPriceCalc = finalSellingPrice;

  if (marketingSpend > 0 && targetROAS > 0 && costAllocationMethod === 'fixed-cost') {
    // Break-Even after marketing
    if (breakEvenUnitsBefore > 0 && breakEvenUnitsBefore !== Infinity) {
      const breakEvenResult = calculateFinalUnitsWithMarketingSpend(
        marketingSpend,
        breakEvenUnitsBefore,
        preliminaryResult.baseSellingPrice,
        baseTotalCostPerUnit,
        operationalExpenses,
        channelFeePercent,
        targetROAS,
        costAllocationMethod,
        0
      );
      if (breakEvenResult) {
        breakEvenUnitsAfter = breakEvenResult.finalUnitsRequired;
        finalMarketingCostPerUnit = breakEvenResult.marketingCostPerUnit;
        finalSellingPriceCalc = breakEvenResult.finalSellingPrice;
      }
    }

    // Target Profit after marketing
    if (targetProfitUnitsBefore > 0 && targetProfitUnitsBefore !== Infinity) {
      const targetProfitResult = calculateFinalUnitsWithMarketingSpend(
        marketingSpend,
        targetProfitUnitsBefore,
        preliminaryResult.baseSellingPrice,
        baseTotalCostPerUnit,
        operationalExpenses,
        channelFeePercent,
        targetROAS,
        costAllocationMethod,
        targetProfitAmount
      );
      if (targetProfitResult) {
        targetProfitUnitsAfter = targetProfitResult.finalUnitsRequired;
      }
    }
  }

  // Final calculations
  const finalTotalCostPerUnit = baseTotalCostPerUnit + finalMarketingCostPerUnit;
  const channelFeePerUnit = (finalSellingPriceCalc * channelFeePercent) / 100;
  const finalNetProfitPerUnit = finalSellingPriceCalc - finalTotalCostPerUnit - channelFeePerUnit;
  const finalProfitMarginPercent = finalSellingPriceCalc > 0 
    ? (finalNetProfitPerUnit / finalSellingPriceCalc) * 100 
    : 0;

  // Revenue calculations
  const breakEvenRevenueBefore = breakEvenUnitsBefore !== Infinity 
    ? breakEvenUnitsBefore * preliminaryResult.baseSellingPrice 
    : Infinity;
  const breakEvenRevenueAfter = breakEvenUnitsAfter !== Infinity 
    ? breakEvenUnitsAfter * finalSellingPriceCalc 
    : Infinity;
  const targetProfitRevenueBefore = targetProfitUnitsBefore > 0 && targetProfitUnitsBefore !== Infinity
    ? targetProfitUnitsBefore * preliminaryResult.baseSellingPrice
    : Infinity;
  const targetProfitRevenueAfter = targetProfitUnitsAfter > 0 && targetProfitUnitsAfter !== Infinity
    ? targetProfitUnitsAfter * finalSellingPriceCalc
    : Infinity;

  // Helper to get pricing method display
  const getPricingMethodDisplay = () => {
    if (calculationMethod === 'markup') {
      return `Markup ${markupPercent}%`;
    } else if (calculationMethod === 'margin') {
      return `Margin ${marginPercent}% dari Production Cost`;
    } else if (calculationMethod === 'fixed') {
      return `Profit Tetap ${formatRupiah(fixedProfit || 0)}`;
    }
    return 'Tidak ditentukan';
  };

  // Helper component for TableHead with Tooltip (without TooltipProvider - using parent provider)
  const TableHeadWithTooltip = ({ 
    children, 
    tooltip, 
    className = "",
    isPurple = false
  }: { 
    children: React.ReactNode; 
    tooltip: string;
    className?: string;
    isPurple?: boolean;
  }) => {
    const hoverBgClass = isPurple ? "hover:bg-primary" : "hover:bg-brand-blue";
    const bgClass = isPurple ? "bg-primary" : "bg-brand-blue";
    
    return (
      <TableHead className={`${className} ${bgClass} ${hoverBgClass}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center justify-end gap-1 cursor-help pointer-events-none">
              <span className="pointer-events-auto">{children}</span>
              <Info className="h-3 w-3 opacity-70 pointer-events-auto hover:opacity-100 transition-opacity" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs z-50">
            <p className="text-sm">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TableHead>
    );
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-brand-blue" />
              Final Summary - Pricing Analysis
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Ringkasan lengkap perhitungan harga jual, biaya, dan target penjualan produk Anda. Hover pada kolom untuk penjelasan detail.
            </p>
          </CardHeader>
          <CardContent>
            {/* Product Information */}
            {(productName || category) && (
              <div className="mb-4 p-3 bg-muted/50 rounded-lg border border-border">
                <h4 className="text-sm font-semibold text-foreground mb-2">Product Information</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {productName && (
                    <div>
                      <span className="text-muted-foreground">Product Name:</span>
                      <p className="font-medium text-foreground">{productName}</p>
                    </div>
                  )}
                  {category && (
                    <div>
                      <span className="text-muted-foreground">Category:</span>
                      <p className="font-medium text-foreground">{category}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pricing Settings Summary */}
            <div className="mb-4 p-3 bg-brand-blue-soft rounded-lg border border-brand-blue/25">
              <h4 className="text-sm font-semibold text-brand-blue-deep mb-2">Pricing Settings (Step 5)</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Pricing Method:</span>
                  <p className="font-medium text-brand-blue-deep">{getPricingMethodDisplay()}</p>
                </div>
                {targetProfitPercent !== undefined && targetProfitPercent > 0 && (
                  <div>
                    <span className="text-muted-foreground">Target Profit:</span>
                    <p className="font-medium text-primary">{targetProfitPercent}% dari Total Biaya</p>
                  </div>
                )}
                {minimumMarginPercent !== undefined && minimumMarginPercent > 0 && (
                  <div>
                    <span className="text-muted-foreground">Minimum Margin:</span>
                    <p className="font-medium text-brand-red">{minimumMarginPercent}%</p>
                  </div>
                )}
                {marketingSpend > 0 && (
                  <div>
                    <span className="text-muted-foreground">Marketing Spend:</span>
                    <p className="font-medium text-primary">{formatRupiah(marketingSpend)} / {timePeriod === 'monthly' ? 'bulan' : 'tahun'}</p>
                  </div>
                )}
                {targetROAS > 0 && (
                  <div>
                    <span className="text-muted-foreground">Target ROAS:</span>
                    <p className="font-medium text-primary">{targetROAS}:1</p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Cost Allocation:</span>
                  <p className="font-medium text-foreground">{costAllocationMethod === 'fixed-cost' ? 'Fixed Cost' : 'Per Unit'}</p>
                </div>
              </div>
            </div>

            <div className="seamless-scroll max-h-[calc(100vh-200px)] overflow-x-auto overflow-y-auto">
              {/* Main Summary Table - Horizontal Layout with Many Columns */}
              <div className="border rounded-lg overflow-hidden min-w-full">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-brand-blue text-brand-white">
                      <TableHead className="font-semibold text-brand-white min-w-[150px] sticky left-0 z-10 bg-brand-blue">
                        <div className="flex items-center gap-1">
                          <span>Item</span>
                        </div>
                      </TableHead>
                      <TableHeadWithTooltip 
                        className="text-right font-semibold text-brand-white min-w-[120px]"
                        tooltip="Biaya produksi per unit produk. Dihitung dari semua komponen cost breakdown di Step 2 (Production Costs)."
                      >
                        Prod Cost
                      </TableHeadWithTooltip>
                      <TableHeadWithTooltip 
                        className="text-right font-semibold text-brand-white min-w-[120px]"
                        tooltip="Biaya operasional per unit. Jika menggunakan metode per-unit allocation, ini adalah total operational expenses dibagi estimasi unit."
                      >
                        Oper Cost
                      </TableHeadWithTooltip>
                      <TableHeadWithTooltip 
                        className="text-right font-semibold text-brand-white min-w-[120px]"
                        tooltip="Biaya marketing per unit. Dihitung dari marketing spend dibagi estimasi unit yang terjual (dari Step 6 - Marketing Costs)."
                      >
                        Marketing Cost
                      </TableHeadWithTooltip>
                      <TableHeadWithTooltip 
                        className="text-right font-semibold text-brand-white min-w-[120px]"
                        tooltip="Biaya fee dari sales channel (misalnya Tokopedia, Shopee). Dihitung sebagai persentase dari final selling price."
                      >
                        Channel Fee
                      </TableHeadWithTooltip>
                      <TableHeadWithTooltip 
                        className="text-right font-semibold text-brand-white min-w-[120px]"
                        tooltip="Total semua biaya per unit: Production Cost + Operational Cost + Marketing Cost. Ini adalah total cost untuk memproduksi dan memasarkan 1 unit."
                      >
                        Total Cost
                      </TableHeadWithTooltip>
                      <TableHeadWithTooltip 
                        className="text-right font-semibold text-brand-white min-w-[120px]"
                        tooltip="Harga jual per unit SEBELUM marketing cost ditambahkan. Dihitung di Step 5 (Pricing Settings) berdasarkan metode yang dipilih (Markup/Margin/Fixed Profit)."
                      >
                        Base Price
                      </TableHeadWithTooltip>
                      <TableHeadWithTooltip 
                        className="text-right font-semibold text-brand-white min-w-[120px]"
                        tooltip="Harga jual per unit SETELAH marketing cost ditambahkan. Final Price = Base Price + Marketing Cost per Unit. Ini adalah harga jual final yang akan digunakan."
                      >
                        Final Price
                      </TableHeadWithTooltip>
                      <TableHeadWithTooltip 
                        className="text-right font-semibold text-brand-white min-w-[120px]"
                        tooltip="Keuntungan bersih per unit SEBELUM marketing cost. Net Profit = Base Price - Total Cost (tanpa marketing) - Channel Fee."
                      >
                        Net Profit Before
                      </TableHeadWithTooltip>
                      <TableHeadWithTooltip 
                        className="text-right font-semibold text-brand-white min-w-[120px]"
                        tooltip="Keuntungan bersih per unit SETELAH marketing cost. Net Profit = Final Price - Total Cost (dengan marketing) - Channel Fee."
                      >
                        Net Profit After
                      </TableHeadWithTooltip>
                      <TableHeadWithTooltip 
                        className="text-right font-semibold text-brand-white min-w-[100px]"
                        tooltip="Persentase profit margin SEBELUM marketing. Margin = (Net Profit / Base Price) × 100%."
                      >
                        Margin Before
                      </TableHeadWithTooltip>
                      <TableHeadWithTooltip 
                        className="text-right font-semibold text-brand-white min-w-[100px]"
                        tooltip="Persentase profit margin SETELAH marketing. Margin = (Net Profit After / Final Price) × 100%."
                      >
                        Margin After
                      </TableHeadWithTooltip>
                      <TableHeadWithTooltip 
                        className="text-right font-semibold text-brand-white min-w-[130px]"
                        tooltip="Jumlah unit minimum yang harus dijual untuk mencapai break-even (titik impas) SEBELUM marketing cost ditambahkan. Break-even berarti total revenue = total expenses."
                      >
                        BE Units Before
                      </TableHeadWithTooltip>
                      <TableHeadWithTooltip 
                        className="text-right font-semibold text-brand-white min-w-[130px]"
                        tooltip="Jumlah unit minimum yang harus dijual untuk mencapai break-even SETELAH marketing cost ditambahkan. Units ini LEBIH BESAR karena marketing cost mengurangi net profit per unit."
                      >
                        BE Units After
                      </TableHeadWithTooltip>
                      <TableHeadWithTooltip 
                        className="text-right font-semibold text-brand-white min-w-[130px]"
                        tooltip="Jumlah unit yang harus dijual untuk mencapai target profit SEBELUM marketing cost. Target profit adalah keuntungan yang diinginkan (dari Step 5)."
                      >
                        TP Units Before
                      </TableHeadWithTooltip>
                      <TableHeadWithTooltip 
                        className="text-right font-semibold text-brand-white min-w-[130px]"
                        tooltip="Jumlah unit yang harus dijual untuk mencapai target profit SETELAH marketing cost. Units ini LEBIH BESAR karena marketing cost mengurangi net profit per unit."
                      >
                        TP Units After
                      </TableHeadWithTooltip>
                      <TableHeadWithTooltip 
                        className="text-right font-semibold text-brand-white min-w-[140px]"
                        tooltip="Total revenue yang diperlukan untuk mencapai break-even SEBELUM marketing. Revenue = Break-Even Units × Base Price."
                      >
                        BE Revenue Before
                      </TableHeadWithTooltip>
                      <TableHeadWithTooltip 
                        className="text-right font-semibold text-brand-white min-w-[140px]"
                        tooltip="Total revenue yang diperlukan untuk mencapai break-even SETELAH marketing. Revenue = Break-Even Units After × Final Price."
                      >
                        BE Revenue After
                      </TableHeadWithTooltip>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {/* Main Row with All Data */}
                  <TableRow className="hover:bg-muted/50">
                    <TableCell className="font-semibold bg-muted/50 sticky left-0 z-10 min-w-[150px]">
                      Per Unit
                    </TableCell>
                    <TableCell className="text-right">{formatRupiah(preliminaryResult.summary.productionCostPerUnit)}</TableCell>
                    <TableCell className="text-right">{formatRupiah(preliminaryResult.summary.operationalCostPerUnit)}</TableCell>
                    <TableCell className="text-right text-primary font-medium">
                      {finalMarketingCostPerUnit > 0 ? formatRupiah(finalMarketingCostPerUnit) : '-'}
                    </TableCell>
                    <TableCell className="text-right text-brand-red">
                      {channelFeePerUnit > 0 ? formatRupiah(channelFeePerUnit) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-semibold bg-brand-blue-soft">{formatRupiah(finalTotalCostPerUnit)}</TableCell>
                    <TableCell className="text-right">{formatRupiah(preliminaryResult.baseSellingPrice)}</TableCell>
                    <TableCell className="text-right font-semibold text-brand-blue-deep bg-brand-blue-soft">{formatRupiah(finalSellingPriceCalc)}</TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(preliminaryResult.profitPerUnit - (preliminaryResult.baseSellingPrice * channelFeePercent / 100))}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-brand-blue-deep bg-brand-blue-soft">{formatRupiah(finalNetProfitPerUnit)}</TableCell>
                    <TableCell className="text-right">{preliminaryResult.profitMarginPercent.toFixed(2)}%</TableCell>
                    <TableCell className="text-right font-semibold text-brand-blue-deep bg-brand-blue-soft">{finalProfitMarginPercent.toFixed(2)}%</TableCell>
                    <TableCell className="text-right">
                      {breakEvenUnitsBefore === Infinity ? '∞' : formatNumber(breakEvenUnitsBefore)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-brand-blue-deep bg-brand-blue-soft">
                      {breakEvenUnitsAfter === Infinity ? '∞' : formatNumber(breakEvenUnitsAfter)}
                    </TableCell>
                    <TableCell className="text-right">
                      {targetProfitUnitsBefore > 0 && targetProfitUnitsBefore !== Infinity 
                        ? formatNumber(targetProfitUnitsBefore) 
                        : targetProfitUnitsBefore === Infinity ? '∞' : '-'}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-primary bg-primary/10">
                      {targetProfitUnitsAfter > 0 && targetProfitUnitsAfter !== Infinity 
                        ? formatNumber(targetProfitUnitsAfter) 
                        : targetProfitUnitsAfter === Infinity ? '∞' : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {breakEvenRevenueBefore === Infinity ? '∞' : formatRupiah(breakEvenRevenueBefore)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-brand-blue-deep bg-brand-blue-soft">
                      {breakEvenRevenueAfter === Infinity ? '∞' : formatRupiah(breakEvenRevenueAfter)}
                    </TableCell>
                  </TableRow>

                  {/* Additional Row for Target Profit Revenue if exists */}
                  {targetProfitUnitsBefore > 0 && (
                    <TableRow className="hover:bg-muted/50 bg-muted/50/50">
                      <TableCell className="font-semibold bg-muted sticky left-0 z-10 min-w-[150px]">
                        Target Profit Revenue
                      </TableCell>
                      <TableCell className="text-right" colSpan={13}>-</TableCell>
                      <TableCell className="text-right">
                        {targetProfitRevenueBefore === Infinity ? '∞' : formatRupiah(targetProfitRevenueBefore)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary bg-primary/10">
                        {targetProfitRevenueAfter === Infinity ? '∞' : formatRupiah(targetProfitRevenueAfter)}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Marketing Details Table - If Marketing Exists */}
            {marketingSpend > 0 && (
              <div className="mt-4 border rounded-lg overflow-hidden min-w-full">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-primary text-brand-white hover:bg-primary">
                      <TableHead className="font-semibold text-brand-white min-w-[200px] bg-primary hover:bg-primary">Marketing Item</TableHead>
                      <TableHeadWithTooltip 
                        className="text-right font-semibold text-brand-white min-w-[150px]"
                        tooltip={`Total biaya marketing ${timePeriod === 'monthly' ? 'per bulan' : 'per tahun'}. Input dari Step 6 (Marketing Costs).`}
                        isPurple={true}
                      >
                        Marketing Spend
                      </TableHeadWithTooltip>
                      <TableHeadWithTooltip 
                        className="text-right font-semibold text-brand-white min-w-[120px]"
                        tooltip="Target Return on Ad Spend (ROAS). Contoh: ROAS 3:1 berarti setiap Rp 1 marketing spend menghasilkan Rp 3 revenue. Input dari Step 5 atau Step 6."
                        isPurple={true}
                      >
                        Target ROAS
                      </TableHeadWithTooltip>
                      <TableHeadWithTooltip 
                        className="text-right font-semibold text-brand-white min-w-[150px]"
                        tooltip="Revenue yang diharapkan dari marketing spend. Expected Revenue = Marketing Spend × Target ROAS."
                        isPurple={true}
                      >
                        Expected Revenue
                      </TableHeadWithTooltip>
                      <TableHeadWithTooltip 
                        className="text-right font-semibold text-brand-white min-w-[150px]"
                        tooltip="Biaya marketing per unit produk. Marketing Cost per Unit = Marketing Spend ÷ Estimasi Units Sold."
                        isPurple={true}
                      >
                        Marketing/Unit
                      </TableHeadWithTooltip>
                      <TableHeadWithTooltip 
                        className="text-right font-semibold text-brand-white min-w-[150px]"
                        tooltip="Persentase peningkatan unit break-even setelah marketing ditambahkan. Semakin tinggi, berarti marketing cost semakin besar dampaknya."
                        isPurple={true}
                      >
                        BE Unit Change
                      </TableHeadWithTooltip>
                      <TableHeadWithTooltip 
                        className="text-right font-semibold text-brand-white min-w-[150px]"
                        tooltip="Persentase peningkatan unit target profit setelah marketing ditambahkan. Semakin tinggi, berarti marketing cost semakin besar dampaknya."
                        isPurple={true}
                      >
                        TP Unit Change
                      </TableHeadWithTooltip>
                      <TableHeadWithTooltip 
                        className="text-right font-semibold text-brand-white min-w-[150px]"
                        tooltip="Persentase peningkatan revenue break-even setelah marketing ditambahkan. Revenue naik karena selling price naik."
                        isPurple={true}
                      >
                        BE Rev Change
                      </TableHeadWithTooltip>
                      <TableHeadWithTooltip 
                        className="text-right font-semibold text-brand-white min-w-[150px]"
                        tooltip="Persentase peningkatan revenue target profit setelah marketing ditambahkan. Revenue naik karena selling price naik."
                        isPurple={true}
                      >
                        TP Rev Change
                      </TableHeadWithTooltip>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">{timePeriod === 'monthly' ? 'Monthly' : 'Yearly'} Marketing</TableCell>
                      <TableCell className="text-right font-semibold">{formatRupiah(marketingSpend)}</TableCell>
                      <TableCell className="text-right font-semibold">{targetROAS}:1</TableCell>
                      <TableCell className="text-right font-semibold text-brand-blue-deep">{formatRupiah(marketingSpend * targetROAS)}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">{formatRupiah(finalMarketingCostPerUnit)}</TableCell>
                      <TableCell className="text-right text-brand-blue-deep">
                        {breakEvenUnitsBefore !== Infinity && breakEvenUnitsAfter !== Infinity && breakEvenUnitsBefore > 0
                          ? `+${(((breakEvenUnitsAfter - breakEvenUnitsBefore) / breakEvenUnitsBefore) * 100).toFixed(1)}%`
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right text-primary">
                        {targetProfitUnitsBefore !== Infinity && targetProfitUnitsAfter !== Infinity && targetProfitUnitsBefore > 0
                          ? `+${(((targetProfitUnitsAfter - targetProfitUnitsBefore) / targetProfitUnitsBefore) * 100).toFixed(1)}%`
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right text-brand-blue-deep">
                        {breakEvenRevenueBefore !== Infinity && breakEvenRevenueAfter !== Infinity && breakEvenRevenueBefore > 0
                          ? `+${(((breakEvenRevenueAfter - breakEvenRevenueBefore) / breakEvenRevenueBefore) * 100).toFixed(1)}%`
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right text-primary">
                        {targetProfitRevenueBefore !== Infinity && targetProfitRevenueAfter !== Infinity && targetProfitRevenueBefore > 0
                          ? `+${(((targetProfitRevenueAfter - targetProfitRevenueBefore) / targetProfitRevenueBefore) * 100).toFixed(1)}%`
                          : '-'}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Legend/Notes */}
            <div className="mt-4 rounded-lg border border-brand-blue/25 bg-brand-blue-soft p-3">
              <p className="text-xs text-foreground mb-1"><strong>Legenda:</strong></p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                <div>• BE = Break-Even</div>
                <div>• TP = Target Profit</div>
                <div>• Prod = Production</div>
                <div>• Oper = Operational</div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                <strong>Catatan:</strong> Units setelah marketing meningkat karena marketing cost mengurangi net profit per unit.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </TooltipProvider>
  );
};

