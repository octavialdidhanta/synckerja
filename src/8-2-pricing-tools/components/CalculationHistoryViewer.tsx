import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/shared/components/ui/dialog';
import { 
  History, 
  Trash2, 
  Download, 
  Eye, 
  Loader2,
  Calendar,
  FileText,
  Edit,
  Save
} from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/shared/components/ui/table';
import { usePricingCalculations, SavedCalculation } from '../hooks/usePricingCalculations';
import { formatRupiah, formatNumber } from '../lib/pricingUtils';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Separator } from '@/shared/components/ui/separator';

interface CalculationHistoryViewerProps {
  onLoadCalculation?: (calculation: SavedCalculation) => void;
}

export const CalculationHistoryViewer = ({ onLoadCalculation }: CalculationHistoryViewerProps) => {
  const { calculations, isLoading, deleteCalculation, isDeleting, updateCalculation, isUpdating } = usePricingCalculations();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCalculation, setSelectedCalculation] = useState<SavedCalculation | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editCalculationName, setEditCalculationName] = useState('');

  const handleDelete = async (calculation: SavedCalculation) => {
    try {
      await deleteCalculation(calculation.id);
      setDeleteDialogOpen(false);
      setSelectedCalculation(null);
    } catch {
      // Error shown via mutation onError toast
    }
  };

  const handleViewDetails = (calculation: SavedCalculation) => {
    setSelectedCalculation(calculation);
    setViewDialogOpen(true);
  };

  const handleLoadCalculation = (calculation: SavedCalculation, closeDialog = false) => {
    if (onLoadCalculation) {
      onLoadCalculation(calculation);
    }
    if (closeDialog) {
      setViewDialogOpen(false);
    }
  };

  const handleEditCalculation = (calculation: SavedCalculation) => {
    setSelectedCalculation(calculation);
    setEditCalculationName(calculation.calculation_name);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedCalculation || !editCalculationName.trim()) {
      return;
    }

    try {
      await updateCalculation({
        id: selectedCalculation.id,
        calculationName: editCalculationName.trim(),
        input: selectedCalculation.calculation_input,
        result: selectedCalculation.calculation_result,
      });
      setEditDialogOpen(false);
      setSelectedCalculation(null);
      setEditCalculationName('');
    } catch {
      // Error shown via mutation onError toast
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

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-5 w-5 text-brand-blue" />
            Calculation History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {calculations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm">No saved calculations yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Save your calculations to see them here
              </p>
            </div>
          ) : (
            <div className="w-full seamless-scroll" style={{ maxHeight: '600px', overflow: 'auto' }}>
              <Table className="min-w-max">
                <TableHeader className="sticky top-0 bg-white z-10 border-b-2 shadow-sm">
                  <TableRow>
                    {/* Basic Information */}
                    <TableHead className="min-w-[180px] whitespace-nowrap">Calculation Name</TableHead>
                    <TableHead className="min-w-[150px] whitespace-nowrap">Product Name</TableHead>
                    <TableHead className="min-w-[120px] whitespace-nowrap">Category</TableHead>
                    <TableHead className="min-w-[140px] whitespace-nowrap">Date Created</TableHead>
                    
                    {/* Cost Structure */}
                    <TableHead className="min-w-[130px] text-right whitespace-nowrap">Production Cost/Unit</TableHead>
                    <TableHead className="min-w-[130px] text-right whitespace-nowrap">Business Expenses</TableHead>
                    <TableHead className="min-w-[130px] text-right whitespace-nowrap">Total Cost/Unit</TableHead>
                    
                    {/* Pricing & Profit */}
                    <TableHead className="min-w-[140px] text-right whitespace-nowrap">Selling Price</TableHead>
                    <TableHead className="min-w-[100px] text-right whitespace-nowrap">Profit Margin</TableHead>
                    <TableHead className="min-w-[120px] text-right whitespace-nowrap">Profit/Unit</TableHead>
                    <TableHead className="min-w-[100px] text-right whitespace-nowrap">Target Profit %</TableHead>
                    
                    {/* Units Analysis */}
                    <TableHead className="min-w-[130px] text-right whitespace-nowrap">Break-Even Units</TableHead>
                    <TableHead className="min-w-[130px] text-right whitespace-nowrap">Target Units</TableHead>
                    <TableHead className="min-w-[150px] text-right whitespace-nowrap">Production Cost @ Target Units</TableHead>
                    
                    {/* Sales Channels */}
                    <TableHead className="min-w-[200px] whitespace-nowrap">Sales Channels (Fee %)</TableHead>
                    
                    {/* Actions */}
                    <TableHead 
                      className="min-w-[180px] text-center whitespace-nowrap sticky right-0 bg-white"
                      style={{ boxShadow: '-2px 0 4px rgba(0,0,0,0.1)' }}
                    >
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calculations.map((calculation) => {
                    const input = calculation.calculation_input;
                    const result = calculation.calculation_result;
                    
                    // Calculate total cost per unit
                    const totalCostPerUnit = result.totalCostPerUnit || 
                      (input.productionCostPerUnit || 0) + 
                      (input.costAllocationMethod === 'per-unit' 
                        ? (input.totalOperationalExpenses || 0) 
                        : 0);
                    
                    // Calculate production cost at target units
                    const targetUnits = result.targetProfit?.unitsRequired;
                    const productionCostAtTargetUnits = targetUnits && targetUnits !== Infinity && targetUnits > 0
                      ? (input.productionCostPerUnit || 0) * targetUnits
                      : null;
                    
                    return (
                      <TableRow key={calculation.id} className="hover:bg-muted/50">
                        {/* Basic Information */}
                        <TableCell className="font-medium whitespace-nowrap">
                          {calculation.calculation_name}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {input.productName || '-'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {input.category || '-'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3 flex-shrink-0" />
                            <span>{format(new Date(calculation.created_at), 'dd MMM yyyy, HH:mm', { locale: id })}</span>
                          </div>
                        </TableCell>
                        
                        {/* Cost Structure */}
                        <TableCell className="text-right text-sm text-foreground whitespace-nowrap">
                          {input.productionCostPerUnit
                            ? formatRupiah(input.productionCostPerUnit)
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right text-sm text-foreground whitespace-nowrap">
                          {input.totalOperationalExpenses
                            ? formatRupiah(input.totalOperationalExpenses)
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium text-foreground whitespace-nowrap">
                          {totalCostPerUnit > 0
                            ? formatRupiah(totalCostPerUnit)
                            : '-'}
                        </TableCell>
                        
                        {/* Pricing & Profit */}
                        <TableCell className="text-right font-semibold whitespace-nowrap">
                          {formatRupiah(result.summary.recommendedSellingPrice)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Badge 
                            variant={
                              result.profitMarginPercent >= 30 
                                ? 'default' 
                                : result.profitMarginPercent >= 15
                                ? 'secondary'
                                : 'destructive'
                            }
                            className="text-xs whitespace-nowrap"
                          >
                            {result.profitMarginPercent.toFixed(2)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium text-brand-blue-deep whitespace-nowrap">
                          {formatRupiah(result.profitPerUnit)}
                        </TableCell>
                        <TableCell className="text-right text-sm whitespace-nowrap">
                          {input.targetProfitPercent
                            ? `${input.targetProfitPercent.toFixed(1)}%`
                            : '-'}
                        </TableCell>
                        
                        {/* Units Analysis */}
                        <TableCell className="text-right text-sm whitespace-nowrap">
                          {result.breakEven.unitsRequired === Infinity
                            ? '∞'
                            : formatNumber(result.breakEven.unitsRequired)}
                        </TableCell>
                        <TableCell className="text-right text-sm whitespace-nowrap">
                          {result.targetProfit?.unitsRequired
                            ? (result.targetProfit.unitsRequired === Infinity
                                ? '∞'
                                : formatNumber(result.targetProfit.unitsRequired))
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right text-sm text-foreground whitespace-nowrap">
                          {productionCostAtTargetUnits
                            ? formatRupiah(productionCostAtTargetUnits)
                            : '-'}
                        </TableCell>
                        
                        {/* Sales Channels */}
                        <TableCell className="whitespace-nowrap">
                          <div className="space-y-0.5">
                            {result.channelPricing.length > 0 ? (
                              result.channelPricing.map((channel) => {
                                // Get fee from channel input
                                const channelInput = input.salesChannels?.find(
                                  ch => ch.id === channel.channelId
                                );
                                const feePercent = channelInput?.totalFeePercent || 
                                  (channel.fees && channel.sellingPrice > 0 
                                    ? (channel.fees / channel.sellingPrice) * 100 
                                    : 0);
                                
                                return (
                                  <div key={channel.channelId} className="text-xs whitespace-nowrap">
                                    <span className="font-medium">{channel.channelName}:</span>
                                    <span className="text-muted-foreground ml-1">
                                      {feePercent > 0 ? `${feePercent.toFixed(1)}%` : '-'}
                                    </span>
                                  </div>
                                );
                              })
                            ) : (
                              <span className="text-xs text-muted-foreground/60">-</span>
                            )}
                          </div>
                        </TableCell>
                        
                        {/* Actions */}
                        <TableCell 
                          className="sticky right-0 bg-white z-10 whitespace-nowrap"
                          style={{ boxShadow: '-2px 0 4px rgba(0,0,0,0.1)' }}
                        >
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleViewDetails(calculation)}
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleEditCalculation(calculation)}
                              title="Edit Name"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleLoadCalculation(calculation, false)}
                              disabled={!onLoadCalculation}
                              title="Load to Form"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                setSelectedCalculation(calculation);
                                setDeleteDialogOpen(true);
                              }}
                              disabled={isDeleting}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Calculation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedCalculation?.calculation_name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setDeleteDialogOpen(false);
                setSelectedCalculation(null);
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => selectedCalculation && handleDelete(selectedCalculation)}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedCalculation?.calculation_name}</DialogTitle>
            <DialogDescription>
              Calculation details from {selectedCalculation && format(new Date(selectedCalculation.created_at), 'dd MMMM yyyy, HH:mm', { locale: id })}
            </DialogDescription>
          </DialogHeader>
          
          {selectedCalculation && (
            <div className="space-y-4 py-4">
              {/* Summary */}
              <div className="bg-brand-blue-soft p-4 rounded-lg">
                <h4 className="font-medium text-sm mb-2">Summary</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Recommended Price:</span>
                    <p className="font-bold text-brand-blue-deep">
                      {formatRupiah(selectedCalculation.calculation_result.summary.recommendedSellingPrice)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Profit Margin:</span>
                    <p className="font-bold text-primary">
                      {selectedCalculation.calculation_result.profitMarginPercent.toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Profit per Unit:</span>
                    <p className="font-bold text-brand-blue-deep">
                      {formatRupiah(selectedCalculation.calculation_result.profitPerUnit)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Break-Even Units (to Sell):</span>
                    <p className="font-medium">
                      {selectedCalculation.calculation_result.breakEven.unitsRequired === Infinity
                        ? '∞'
                        : selectedCalculation.calculation_result.breakEven.unitsRequired.toLocaleString('id-ID')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Channel Pricing */}
              {selectedCalculation.calculation_result.channelPricing.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium text-sm mb-2">Channel Pricing</h4>
                    <div className="space-y-2">
                      {selectedCalculation.calculation_result.channelPricing.map((channel) => (
                        <div
                          key={channel.channelId}
                          className="p-3 bg-muted/50 rounded-lg border border-border"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-sm">{channel.channelName}</span>
                            <div className="text-right">
                              <p className="font-bold text-sm">
                                {formatRupiah(channel.sellingPrice)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {channel.profitMargin.toFixed(2)}% margin
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Input Details (collapsed by default, can expand) */}
              <Separator />
              <details className="text-sm">
                <summary className="cursor-pointer font-medium text-foreground hover:text-foreground">
                  Input Details
                </summary>
                <div className="mt-3 p-3 bg-muted/50 rounded-lg space-y-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Production Cost per Unit: </span>
                    <span className="font-medium">
                      {selectedCalculation.calculation_input.productionCostPerUnit 
                        ? `Rp ${selectedCalculation.calculation_input.productionCostPerUnit.toLocaleString('id-ID')}`
                        : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Target Profit: </span>
                    <span className="font-medium">
                      {selectedCalculation.calculation_input.targetProfitPercent}%
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Minimum Margin: </span>
                    <span className="font-medium">
                      {selectedCalculation.calculation_input.minimumMarginPercent}%
                    </span>
                  </div>
                </div>
              </details>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
            {onLoadCalculation && (
              <Button onClick={() => selectedCalculation && handleLoadCalculation(selectedCalculation, true)}>
                <Download className="h-4 w-4 mr-2" />
                Load to Form
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Calculation Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Calculation Name</DialogTitle>
            <DialogDescription>
              Update the name for "{selectedCalculation?.calculation_name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-calculation-name">Calculation Name</Label>
              <Input
                id="edit-calculation-name"
                placeholder="Enter calculation name"
                value={editCalculationName}
                onChange={(e) => setEditCalculationName(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setEditDialogOpen(false);
                setSelectedCalculation(null);
                setEditCalculationName('');
              }}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveEdit}
              disabled={!editCalculationName.trim() || isUpdating}
            >
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

