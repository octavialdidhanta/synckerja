import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from '@/shared/components/ui/dialog';
import { 
  GitCompare, 
  Plus, 
  X, 
  TrendingUp,
  AlertTriangle,
  Loader2,
  FileText
} from 'lucide-react';
import { usePricingCalculations, SavedCalculation } from '../hooks/usePricingCalculations';
import { formatRupiah, formatNumber } from '../lib/pricingUtils';
import { Separator } from '@/shared/components/ui/separator';

interface MultipleProductComparisonProps {
  // Optional: can be used to add current calculation to comparison
  currentCalculation?: {
    name: string;
    result: any;
  } | null;
}

export const MultipleProductComparison = ({ currentCalculation }: MultipleProductComparisonProps) => {
  const { calculations, isLoading } = usePricingCalculations();
  const [selectedCalculations, setSelectedCalculations] = useState<Set<string>>(new Set());
  const [comparisonDialogOpen, setComparisonDialogOpen] = useState(false);

  const toggleSelection = (id: string) => {
    setSelectedCalculations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getSelectedCalculationsData = (): SavedCalculation[] => {
    return calculations.filter(calc => selectedCalculations.has(calc.id));
  };

  const handleCompare = () => {
    if (selectedCalculations.size >= 2) {
      setComparisonDialogOpen(true);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/60" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectedData = getSelectedCalculationsData();

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GitCompare className="h-5 w-5 text-primary" />
            Product Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          {calculations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm">No saved calculations yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Save at least 2 calculations to compare products
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-muted-foreground">
                  Select at least 2 products to compare
                </p>
                <Button
                  size="sm"
                  onClick={handleCompare}
                  disabled={selectedCalculations.size < 2}
                >
                  <GitCompare className="h-4 w-4 mr-2" />
                  Compare ({selectedCalculations.size})
                </Button>
              </div>

              <div className="space-y-2 max-h-[400px] overflow-y-auto seamless-scroll">
                {calculations.map((calculation) => {
                  const isSelected = selectedCalculations.has(calculation.id);
                  return (
                    <div
                      key={calculation.id}
                      className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-brand-blue-soft border-brand-blue/35'
                          : 'bg-muted/50 border-border hover:border-primary/25'
                      }`}
                      onClick={() => toggleSelection(calculation.id)}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelection(calculation.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm mb-1 truncate">
                            {calculation.calculation_name}
                          </h4>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Price:</span>
                              <p className="font-medium">
                                {formatRupiah(calculation.calculation_result.summary.recommendedSellingPrice)}
                              </p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Margin:</span>
                              <p className="font-medium">
                                {calculation.calculation_result.profitMarginPercent.toFixed(2)}%
                              </p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Profit:</span>
                              <p className="font-medium">
                                {formatRupiah(calculation.calculation_result.profitPerUnit)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comparison Dialog */}
      <Dialog open={comparisonDialogOpen} onOpenChange={setComparisonDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Product Comparison</DialogTitle>
            <DialogDescription>
              Compare {selectedData.length} products side by side
            </DialogDescription>
          </DialogHeader>

          {selectedData.length >= 2 && (
            <div className="py-4">
              {/* Comparison Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-border">
                      <th className="text-left p-3 font-semibold text-sm sticky left-0 bg-white z-10 min-w-[200px]">
                        Metric
                      </th>
                      {selectedData.map((calc) => (
                        <th
                          key={calc.id}
                          className="text-center p-3 font-semibold text-sm border-l border-border min-w-[180px]"
                        >
                          <div className="flex flex-col items-center">
                            <span className="font-bold">{calc.calculation_name}</span>
                            <span className="text-xs text-muted-foreground font-normal mt-1">
                              {calc.calculation_input.category || 'N/A'}
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Recommended Price */}
                    <tr className="border-b border-border">
                      <td className="p-3 font-medium text-sm sticky left-0 bg-muted/50">
                        Recommended Price
                      </td>
                      {selectedData.map((calc) => (
                        <td
                          key={calc.id}
                          className="p-3 text-center border-l border-border bg-brand-blue-soft"
                        >
                          <span className="font-bold text-brand-blue-deep">
                            {formatRupiah(calc.calculation_result.summary.recommendedSellingPrice)}
                          </span>
                        </td>
                      ))}
                    </tr>

                    {/* Profit Margin */}
                    <tr className="border-b border-border">
                      <td className="p-3 font-medium text-sm sticky left-0 bg-muted/50">
                        Profit Margin
                      </td>
                      {selectedData.map((calc) => {
                        const margin = calc.calculation_result.profitMarginPercent;
                        return (
                          <td
                            key={calc.id}
                            className="p-3 text-center border-l border-border"
                          >
                            <Badge
                              variant={
                                margin >= 30
                                  ? 'default'
                                  : margin >= 20
                                  ? 'secondary'
                                  : margin >= 10
                                  ? 'outline'
                                  : 'destructive'
                              }
                            >
                              {margin.toFixed(2)}%
                            </Badge>
                          </td>
                        );
                      })}
                    </tr>

                    {/* Profit per Unit */}
                    <tr className="border-b border-border">
                      <td className="p-3 font-medium text-sm sticky left-0 bg-muted/50">
                        Profit per Unit
                      </td>
                      {selectedData.map((calc) => (
                        <td
                          key={calc.id}
                          className="p-3 text-center border-l border-border bg-brand-blue-soft"
                        >
                          <span className="font-bold text-brand-blue-deep">
                            {formatRupiah(calc.calculation_result.profitPerUnit)}
                          </span>
                        </td>
                      ))}
                    </tr>

                    {/* Break-Even Units */}
                    <tr className="border-b border-border">
                      <td className="p-3 font-medium text-sm sticky left-0 bg-muted/50">
                        Break-Even Units (to Sell)
                      </td>
                      {selectedData.map((calc) => (
                        <td
                          key={calc.id}
                          className="p-3 text-center border-l border-border"
                        >
                          {calc.calculation_result.breakEven.unitsRequired === Infinity
                            ? '∞'
                            : formatNumber(calc.calculation_result.breakEven.unitsRequired)}
                        </td>
                      ))}
                    </tr>

                    {/* Target Units */}
                    {selectedData.some(calc => calc.calculation_result.targetProfit) && (
                      <tr className="border-b border-border">
                        <td className="p-3 font-medium text-sm sticky left-0 bg-muted/50">
                          Target Units (to Sell)
                        </td>
                        {selectedData.map((calc) => (
                          <td
                            key={calc.id}
                            className="p-3 text-center border-l border-border"
                          >
                            {calc.calculation_result.targetProfit
                              ? calc.calculation_result.targetProfit.unitsRequired === Infinity
                                ? '∞'
                                : formatNumber(calc.calculation_result.targetProfit.unitsRequired)
                              : 'N/A'}
                          </td>
                        ))}
                      </tr>
                    )}

                    {/* Production Cost per Unit */}
                    <tr className="border-b border-border bg-muted/50">
                      <td className="p-3 font-medium text-sm sticky left-0 bg-muted/50">
                        Production Cost per Unit
                      </td>
                      {selectedData.map((calc) => (
                        <td
                          key={calc.id}
                          className="p-3 text-center border-l border-border"
                        >
                          {calc.calculation_input.productionCostPerUnit
                            ? formatRupiah(calc.calculation_input.productionCostPerUnit)
                            : calc.calculation_input.totalProductionCost
                            ? formatRupiah(calc.calculation_input.totalProductionCost) // Legacy support
                            : 'N/A'}
                        </td>
                      ))}
                    </tr>

                    {/* Channel Pricing Comparison */}
                    {selectedData.some(calc => calc.calculation_result.channelPricing.length > 0) && (
                      <>
                        <tr className="border-t-2 border-border bg-brand-blue-soft">
                          <td
                            colSpan={selectedData.length + 1}
                            className="p-3 font-bold text-center text-brand-blue-deep"
                          >
                            Channel Pricing Comparison
                          </td>
                        </tr>
                        {selectedData[0]?.calculation_result.channelPricing.map((channel, idx) => (
                          <tr key={channel.channelId} className="border-b border-border">
                            <td className="p-3 font-medium text-sm sticky left-0 bg-muted/50">
                              {channel.channelName}
                            </td>
                            {selectedData.map((calc) => {
                              const channelPricing = calc.calculation_result.channelPricing.find(
                                cp => cp.channelId === channel.channelId || cp.channelName === channel.channelName
                              );
                              return (
                                <td
                                  key={calc.id}
                                  className="p-3 text-center border-l border-border"
                                >
                                  {channelPricing ? (
                                    <div>
                                      <p className="font-medium">
                                        {formatRupiah(channelPricing.sellingPrice)}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {channelPricing.profitMargin.toFixed(2)}% margin
                                      </p>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground/60 text-sm">N/A</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </>
                    )}

                    {/* Warnings */}
                    {selectedData.some(calc => calc.calculation_result.warnings.lowMargin) && (
                      <tr className="border-t-2 border-brand-red/30 bg-brand-red/5">
                        <td className="p-3 font-medium text-sm sticky left-0 bg-brand-red/5">
                          <AlertTriangle className="h-4 w-4 inline mr-1 text-brand-red" />
                          Warnings
                        </td>
                        {selectedData.map((calc) => (
                          <td
                            key={calc.id}
                            className="p-3 border-l border-border"
                          >
                            {calc.calculation_result.warnings.lowMargin ? (
                              <div className="text-xs text-brand-red">
                                {calc.calculation_result.warnings.lowMarginMessage}
                              </div>
                            ) : (
                              <span className="text-muted-foreground/60 text-xs">✓ No warnings</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setComparisonDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

