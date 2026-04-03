
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group';
import { Plus, Trash2, DollarSign } from 'lucide-react';
import { Separator } from '@/shared/components/ui/separator';
import { CostCategory } from '../types/pricingTypes';

// Helper function untuk format currency dengan titik sebagai separator
const formatCurrency = (value: number): string => {
  return value.toLocaleString('id-ID', { 
    minimumFractionDigits: 0,
    maximumFractionDigits: 2 
  });
};

interface CostItem {
  id: string;
  name: string;
  amount: number;
  // Labor-specific fields
  timePeriod?: 'hourly' | 'daily' | 'monthly';
  quantity?: number;
  monthlySalary?: number;
  workingDaysPerMonth?: number;
  workingHoursPerDay?: number;
  hoursPerUnit?: number;
  vendorRate?: number;
  vendorTimePeriod?: 'hourly' | 'daily' | 'monthly';
  unitsPerTimePeriod?: number;
  calculationMethod?: 'salary' | 'vendor' | 'manual'; // Method yang digunakan
  manualCostPerUnit?: number; // Cost per unit langsung (override Rate × Quantity jika diisi)
  flatRate?: number; // Flat rate untuk shipping (total cost untuk batch)
  flatRateUnits?: number; // Jumlah unit yang diantar dengan flat rate tersebut
  // Marketing ROAS-specific fields
  marketingSpend?: number; // Marketing spend bulanan
  targetROAS?: number; // Target ROAS (mis. 3 berarti 3:1)
  estimatedUnitsSold?: number; // Estimasi units sold (auto-calculated, read-only)
  estimatedSellingPrice?: number; // Estimated selling price (auto-calculated, read-only) = Production Cost
  expectedRevenue?: number; // Expected revenue (auto-calculated dari ROAS)
  marketingCalculationMethod?: 'roas' | 'flat-rate' | 'manual'; // Method untuk marketing
}

interface CostCategory {
  id: string;
  title: string;
  items: CostItem[];
  color: string;
  isLaborCategory?: boolean;
}

interface DynamicCostBreakdownProps {
  onTotalChange?: (costPerUnit: number) => void; // Sekarang mengirim cost per unit, bukan total
  onCostBreakdownChange?: (costBreakdown: CostCategory[]) => void;
  initialCostCategories?: CostCategory[];
  key?: string;
}

const DEFAULT_CATEGORIES: CostCategory[] = [
  {
    id: 'raw-materials',
    title: 'Raw Materials',
    items: [],
    color: 'text-brand-blue'
  },
  {
    id: 'labor-cost',
    title: 'Labor Cost',
    items: [],
    color: 'text-primary',
    isLaborCategory: true
  },
  {
    id: 'overhead',
    title: 'Overhead',
    items: [],
    color: 'text-primary'
  },
  // Marketing Cost removed - now handled in Step 6 (Marketing Costs)
  {
    id: 'other-cost',
    title: 'Other Costs',
    items: [],
    color: 'text-muted-foreground'
  }
];

export const DynamicCostBreakdown: React.FC<DynamicCostBreakdownProps> = ({
  onTotalChange,
  onCostBreakdownChange,
  initialCostCategories,
}) => {
  const [costCategories, setCostCategories] = useState<CostCategory[]>(() => {
    // If initial data provided, use it; otherwise use defaults
    if (initialCostCategories && initialCostCategories.length > 0) {
      return initialCostCategories;
    }
    return DEFAULT_CATEGORIES;
  });

  // Re-populate when initialCostCategories changes (for template loading)
  useEffect(() => {
    if (initialCostCategories && initialCostCategories.length > 0) {
      // Filter out admin-cost category (moved to Business Expenses)
      // Filter out marketing-cost category (moved to Step 6 - Marketing Costs)
      // But keep it for backward compatibility display (will be excluded from total calculation)
      const filteredCategories = initialCostCategories.filter(
        category => category.id !== 'admin-cost' && category.id !== 'marketing-cost'
      );
      setCostCategories(filteredCategories);
    } else if (!initialCostCategories) {
      // Reset to defaults if initial data is cleared
      setCostCategories(DEFAULT_CATEGORIES);
    }
  }, [initialCostCategories]);

  const addCostItem = (categoryId: string) => {
    // Prevent adding items to admin-cost category (moved to Business Expenses)
    if (categoryId === 'admin-cost') {
      return;
    }
    setCostCategories(prev => prev.map(category => {
      if (category.id === categoryId) {
        const newItem: CostItem = {
          id: `${categoryId}-${Date.now()}`,
          name: '',
          amount: 0,
          ...(category.isLaborCategory && {
            calculationMethod: 'salary', // Default to salary method
            // Keep all fields empty by default
            timePeriod: undefined,
            quantity: undefined,
            monthlySalary: undefined,
            workingDaysPerMonth: undefined,
            workingHoursPerDay: undefined,
            hoursPerUnit: undefined,
            vendorRate: undefined,
            vendorTimePeriod: undefined,
            unitsPerTimePeriod: undefined,
            manualCostPerUnit: undefined
          }),
          ...(isMarketingCategory(category) && {
            marketingCalculationMethod: 'roas', // Default to ROAS method
            // Keep all fields empty by default
            marketingSpend: undefined,
            targetROAS: undefined,
            estimatedUnitsSold: undefined,
            estimatedSellingPrice: undefined,
            expectedRevenue: undefined,
            flatRate: undefined,
            flatRateUnits: undefined,
            manualCostPerUnit: undefined
          })
        };
        return {
          ...category,
          items: [...category.items, newItem]
        };
      }
      return category;
    }));
  };

  const removeCostItem = (categoryId: string, itemId: string) => {
    setCostCategories(prev => prev.map(category => {
      if (category.id === categoryId) {
        return {
          ...category,
          items: category.items.filter(item => item.id !== itemId)
        };
      }
      return category;
    }));
  };

  const updateCostItem = (categoryId: string, itemId: string, field: keyof CostItem, value: string | number | boolean) => {
    setCostCategories(prev => prev.map(category => {
      if (category.id === categoryId) {
        return {
          ...category,
          items: category.items.map(item => {
            if (item.id === itemId) {
              return {
                ...item,
                [field]: value
              };
            }
            return item;
          })
        };
      }
      return category;
    }));
  };

  // Helper function untuk check apakah category adalah shipping
  const isShippingCategory = (category: CostCategory): boolean => {
    return category.id === 'shipping' || category.title.toLowerCase().includes('shipping');
  };

  // Helper function untuk check apakah category adalah overhead
  const isOverheadCategory = (category: CostCategory): boolean => {
    return category.id === 'overhead' || category.title.toLowerCase().includes('overhead');
  };

  // Helper function untuk check apakah category adalah marketing
  const isMarketingCategory = (category: CostCategory): boolean => {
    return category.id === 'marketing-cost' || category.title.toLowerCase().includes('marketing');
  };

  const calculateItemTotal = (item: CostItem, category: CostCategory) => {
    // Priority 0: Marketing ROAS calculation
    if (isMarketingCategory(category)) {
      const calculationMethod = item.marketingCalculationMethod || 'roas';
      
      // ROAS-based calculation tanpa margin (menggunakan production cost langsung)
      if (calculationMethod === 'roas') {
        const marketingSpend = item.marketingSpend ?? 0;
        const targetROAS = item.targetROAS ?? 0;
        const estimatedUnitsSold = item.estimatedUnitsSold ?? 0;
        
        // Jika sudah ada estimatedUnitsSold (dari auto-calculation), gunakan itu
        if (marketingSpend > 0 && estimatedUnitsSold > 0) {
          return marketingSpend / estimatedUnitsSold;
        }
        
        // Fallback: jika belum ada estimatedUnitsSold, hitung manual
        if (marketingSpend > 0 && targetROAS > 0) {
          // Get production cost per unit WITHOUT marketing
          const productionCostWithoutMarketing = getProductionCostWithoutMarketing();
          
          if (productionCostWithoutMarketing > 0) {
            // Expected Revenue = Marketing Spend × Target ROAS
            const expectedRevenue = marketingSpend * targetROAS;
            
            // Estimated Selling Price = Production Cost (tanpa marketing) × 1.0 (tanpa margin)
            const estimatedSellingPrice = productionCostWithoutMarketing;
            
            // Estimasi Units Sold = Expected Revenue ÷ Production Cost
            const calculatedEstimatedUnitsSold = estimatedSellingPrice > 0 ? expectedRevenue / estimatedSellingPrice : 0;
            
            // Marketing Cost per Unit = Marketing Spend ÷ Estimasi Units Sold
            if (calculatedEstimatedUnitsSold > 0) {
              return marketingSpend / calculatedEstimatedUnitsSold;
            }
          }
        }
        return 0;
      }
      
      // Flat rate calculation (fallback)
      if (calculationMethod === 'flat-rate') {
        if (item.flatRate && item.flatRateUnits && item.flatRateUnits > 0) {
          return item.flatRate / item.flatRateUnits;
        }
      }
      
      // Manual override
      if (calculationMethod === 'manual' && item.manualCostPerUnit !== undefined && item.manualCostPerUnit > 0) {
        return item.manualCostPerUnit;
      }
      
      // Fallback to amount
      return item.amount || 0;
    }
    
    // Priority 1: Jika kategori shipping atau overhead dan ada flat rate, gunakan flat rate calculation
    if ((isShippingCategory(category) || isOverheadCategory(category)) && item.flatRate && item.flatRateUnits && item.flatRateUnits > 0) {
      return item.flatRate / item.flatRateUnits;
    }
    
    if (category.isLaborCategory) {
      const calculationMethod = item.calculationMethod || 'manual';
      
      // Priority 1: Jika method adalah 'vendor', HANYA gunakan vendor calculation
      if (calculationMethod === 'vendor') {
        const vendorRate = item.vendorRate ?? 0;
        const unitsPerTimePeriod = item.unitsPerTimePeriod ?? 0;
        const vendorTimePeriod = item.vendorTimePeriod || 'hourly';
        
        if (vendorRate > 0 && vendorTimePeriod && unitsPerTimePeriod > 0) {
          // Convert vendor rate ke rate per jam dulu
          let ratePerHour = 0;
          if (vendorTimePeriod === 'hourly') {
            ratePerHour = vendorRate;
          } else if (vendorTimePeriod === 'daily') {
            ratePerHour = vendorRate / 8; // Asumsi 8 jam per hari
          } else if (vendorTimePeriod === 'monthly') {
            ratePerHour = vendorRate / (22 * 8); // Asumsi 22 hari kerja, 8 jam per hari
          }
          
          // Convert units per time period ke units per jam
          let unitsPerHour = 0;
          if (vendorTimePeriod === 'hourly') {
            unitsPerHour = unitsPerTimePeriod;
          } else if (vendorTimePeriod === 'daily') {
            unitsPerHour = unitsPerTimePeriod / 8; // Asumsi 8 jam per hari
          } else if (vendorTimePeriod === 'monthly') {
            unitsPerHour = unitsPerTimePeriod / (22 * 8); // Asumsi 22 hari kerja, 8 jam per hari
          }
          
          // Cost per unit = Rate per jam ÷ Unit per jam
          if (unitsPerHour > 0 && ratePerHour > 0) {
            return ratePerHour / unitsPerHour;
          }
        }
        // Return 0 jika kondisi tidak terpenuhi (untuk vendor method)
        return 0;
      }
      
      // Priority 2: Jika method adalah 'salary', HANYA gunakan salary calculation
      if (calculationMethod === 'salary') {
        if (item.monthlySalary && item.workingDaysPerMonth && item.workingHoursPerDay && item.hoursPerUnit) {
          // Cost per jam = Gaji bulanan ÷ (Hari kerja × Jam kerja per hari)
          const costPerHour = item.monthlySalary / (item.workingDaysPerMonth * item.workingHoursPerDay);
          
          // Cost per unit = Cost per jam × Jam kerja per unit
          const costPerUnit = costPerHour * item.hoursPerUnit;
          
          return costPerUnit;
        }
      }
      
      // Priority 3: Fallback ke perhitungan manual jika method adalah 'manual'
      if (calculationMethod === 'manual') {
        // Jika ada manualCostPerUnit yang diisi (dan bukan 0), gunakan itu (override)
        if (item.manualCostPerUnit !== undefined && item.manualCostPerUnit > 0) {
          return item.manualCostPerUnit;
        }
        // Jika tidak, gunakan perhitungan Rate × Quantity
        if (item.amount && item.quantity && item.quantity > 0) {
          // Semua labor cost adalah per unit: rate × quantity = cost per unit
          return item.amount * item.quantity;
        }
      }
    }
    
    // For overhead category, if no flat rate, use amount directly
    if (isOverheadCategory(category)) {
      return item.amount || 0;
    }
    
    return item.amount || 0;
  };

  const getCategoryTotal = (category: CostCategory) => {
    return category.items.reduce((total, item) => total + calculateItemTotal(item, category), 0);
  };

  const getGrandTotal = () => {
    // Total cost per unit - EXCLUDE marketing cost (marketing moved to Step 6)
    // Still support backward compatibility if marketing category exists in old data
    return costCategories
      .filter(category => !isMarketingCategory(category))
      .reduce((total, category) => total + getCategoryTotal(category), 0);
  };

  // Get production cost per unit WITHOUT marketing cost (untuk estimasi marketing)
  const getProductionCostWithoutMarketing = () => {
    return costCategories
      .filter(category => !isMarketingCategory(category))
      .reduce((total, category) => total + getCategoryTotal(category), 0);
  };

  // Auto-calculate marketing estimates when inputs change
  useEffect(() => {
    let hasChanges = false;
    const updatedCategories = costCategories.map(category => {
      if (isMarketingCategory(category)) {
        const updatedItems = category.items.map(item => {
          if (item.marketingCalculationMethod === 'roas' || !item.marketingCalculationMethod) {
            const marketingSpend = item.marketingSpend ?? 0;
            const targetROAS = item.targetROAS ?? 0;
            
            if (marketingSpend > 0 && targetROAS > 0) {
              // Get production cost per unit WITHOUT marketing (calculate from all non-marketing categories)
              // Exclude current marketing item to avoid circular dependency
              const productionCostWithoutMarketing = costCategories
                .filter(cat => !isMarketingCategory(cat))
                .reduce((total, cat) => {
                  return total + cat.items.reduce((sum, it) => {
                    return sum + calculateItemTotal(it, cat);
                  }, 0);
                }, 0);
              
              if (productionCostWithoutMarketing > 0) {
                // Expected Revenue = Marketing Spend × Target ROAS
                const expectedRevenue = marketingSpend * targetROAS;
                
                // Estimated Selling Price = Production Cost (tanpa marketing) × 1.0 (tanpa margin)
                const estimatedSellingPrice = productionCostWithoutMarketing;
                
                // Estimasi Units Sold = Expected Revenue ÷ Production Cost
                const estimatedUnitsSold = estimatedSellingPrice > 0 ? expectedRevenue / estimatedSellingPrice : 0;
                
                // Check if values changed (with small tolerance for floating point)
                const tolerance = 0.01;
                if (Math.abs((item.expectedRevenue ?? 0) - expectedRevenue) > tolerance || 
                    Math.abs((item.estimatedSellingPrice ?? 0) - estimatedSellingPrice) > tolerance || 
                    Math.abs((item.estimatedUnitsSold ?? 0) - estimatedUnitsSold) > tolerance) {
                  hasChanges = true;
                  return {
                    ...item,
                    expectedRevenue,
                    estimatedSellingPrice,
                    estimatedUnitsSold
                  };
                }
              }
            } else {
              // Clear calculated values if inputs are not complete
              if (item.expectedRevenue !== undefined || item.estimatedSellingPrice !== undefined || item.estimatedUnitsSold !== undefined) {
                hasChanges = true;
                return {
                  ...item,
                  expectedRevenue: undefined,
                  estimatedSellingPrice: undefined,
                  estimatedUnitsSold: undefined
                };
              }
            }
          }
          return item;
        });
        
        if (hasChanges) {
          return { ...category, items: updatedItems };
        }
      }
      return category;
    });
    
    if (hasChanges) {
      setCostCategories(updatedCategories);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // Create a stable dependency string from marketing inputs
    costCategories
      .filter(cat => isMarketingCategory(cat))
      .flatMap(cat => cat.items.map(item => 
        `${item.id}:${item.marketingSpend ?? 0}:${item.targetROAS ?? 0}`
      ))
      .join('|'),
    // Track production cost (non-marketing) changes - use item count and total as proxy
    costCategories
      .filter(cat => !isMarketingCategory(cat))
      .reduce((acc, cat) => {
        const total = getCategoryTotal(cat);
        return acc + cat.items.length + Math.round(total);
      }, 0)
  ]);

  // Notify parent when total or cost breakdown changes
  // Sekarang mengirim cost per unit (bukan total untuk semua unit)
  useEffect(() => {
    if (onTotalChange) {
      const costPerUnit = getGrandTotal(); // Cost per unit dari semua kategori
      onTotalChange(costPerUnit);
    }
    if (onCostBreakdownChange) {
      // Filter out admin-cost category (moved to Business Expenses)
      // Filter out marketing-cost category (moved to Step 6 - Marketing Costs)
      const filteredCategories = costCategories.filter(
        category => category.id !== 'admin-cost' && category.id !== 'marketing-cost'
      );
      onCostBreakdownChange(filteredCategories);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [costCategories]);

  const getTimePeriodLabel = (timePeriod: string) => {
    switch (timePeriod) {
      case 'hourly': return 'per jam';
      case 'daily': return 'per hari';
      case 'monthly': return 'per bulan';
      default: return '';
    }
  };

  const getQuantityLabel = (timePeriod: string) => {
    switch (timePeriod) {
      case 'hourly': return 'Jam';
      case 'daily': return 'Hari';
      case 'monthly': return 'Bulan';
      default: return 'Jumlah';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <DollarSign className="h-5 w-5 text-primary" />
          Cost Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {costCategories
          .filter(category => category.id !== 'admin-cost' && category.id !== 'marketing-cost') // Filter out admin-cost (moved to Business Expenses) and marketing-cost (moved to Step 6)
          .map((category) => (
          <div key={category.id} className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className={`font-semibold text-sm ${category.color}`}>
                {category.title}
              </h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => addCostItem(category.id)}
                className="h-7 px-2"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Item
              </Button>
            </div>

            {category.items.length > 0 && (
              <div className="space-y-2">
                {category.items.map((item) => (
                  <div key={item.id} className="space-y-2 p-3 border rounded-lg bg-muted/50">
                    <div className="flex gap-2 items-center">
                      <div className="flex-1">
                        <Input
                          placeholder="Item name (e.g., Gula, Kopi, Pekerja)"
                          value={item.name}
                          onChange={(e) => updateCostItem(category.id, item.id, 'name', e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCostItem(category.id, item.id)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Section untuk shipping atau overhead flat rate */}
                    {(isShippingCategory(category) || isOverheadCategory(category)) ? (
                      <div className="grid grid-cols-4 gap-3 mt-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Flat Rate</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={item.flatRate || ''}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value.replace(/\./g, '')) || 0;
                              updateCostItem(category.id, item.id, 'flatRate', value);
                            }}
                            className="h-8 text-sm"
                          />
                          <div className="text-xs text-muted-foreground mt-1">
                            {item.flatRate ? `Rp ${formatCurrency(item.flatRate)}` : 'Rp 0'}
                          </div>
                        </div>
                        
                        <div>
                          <Label className="text-xs text-muted-foreground">Unit untuk Flat Rate</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={item.flatRateUnits || ''}
                            onChange={(e) => updateCostItem(category.id, item.id, 'flatRateUnits', parseFloat(e.target.value) || 0)}
                            className="h-8 text-sm"
                          />
                          <div className="text-xs text-muted-foreground mt-1">unit</div>
                        </div>
                        
                        <div>
                          <Label className="text-xs text-muted-foreground">Cost per Unit</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            step="0.01"
                            value={item.manualCostPerUnit !== undefined ? item.manualCostPerUnit : (calculateItemTotal(item, category) || '')}
                            onChange={(e) => {
                              const inputValue = e.target.value;
                              if (inputValue === '' || parseFloat(inputValue) === 0) {
                                updateCostItem(category.id, item.id, 'manualCostPerUnit', undefined);
                              } else {
                                const value = parseFloat(inputValue) || 0;
                                updateCostItem(category.id, item.id, 'manualCostPerUnit', value);
                              }
                            }}
                            className="h-8 text-sm"
                          />
                          <div className="text-xs text-muted-foreground mt-1">
                            {item.manualCostPerUnit !== undefined && item.manualCostPerUnit > 0 
                              ? 'Manual override' 
                              : `Rp ${formatCurrency(calculateItemTotal(item, category) || 0)}`}
                          </div>
                        </div>
                        
                        <div className="flex items-end">
                          <div className="w-full">
                            <Label className="text-xs text-muted-foreground">Formula</Label>
                            <div className="h-8 flex items-center text-xs text-muted-foreground">
                              {item.flatRate && item.flatRateUnits 
                                ? `${formatCurrency(item.flatRate)} ÷ ${formatCurrency(item.flatRateUnits)} = ${formatCurrency(calculateItemTotal(item, category) || 0)}`
                                : 'Masukkan flat rate & unit'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : !category.isLaborCategory && !isOverheadCategory(category) && !isMarketingCategory(category) ? (
                      <div className="flex gap-2 items-center">
                        <div className="w-32">
                          <Label className="text-xs text-muted-foreground">Amount</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={item.amount || ''}
                            onChange={(e) => updateCostItem(category.id, item.id, 'amount', parseFloat(e.target.value) || 0)}
                            className="h-8 text-sm"
                          />
                          <div className="text-xs text-muted-foreground mt-1">
                            {item.amount ? `Rp ${formatCurrency(item.amount)}` : 'Rp 0'}
                          </div>
                        </div>
                      </div>
                    ) : null}
                    
                    {/* Section untuk perhitungan marketing cost dengan ROAS */}
                    {isMarketingCategory(category) && (
                      <div className="col-span-full mt-4 space-y-4">
                        {/* Radio buttons untuk pilih metode perhitungan marketing */}
                        <div className="p-3 bg-muted/50 border border-border rounded-lg">
                          <Label className="text-xs font-semibold text-foreground mb-2 block">
                            Metode Perhitungan Marketing:
                          </Label>
                          <RadioGroup
                            value={item.marketingCalculationMethod || 'roas'}
                            onValueChange={(value) => {
                              const newMethod = value as 'roas' | 'flat-rate' | 'manual';
                              const updatedItem: Partial<CostItem> = {
                                marketingCalculationMethod: newMethod
                              };
                              
                              if (newMethod === 'roas') {
                                // Clear flat rate dan manual fields
                                updatedItem.flatRate = undefined;
                                updatedItem.flatRateUnits = undefined;
                                updatedItem.manualCostPerUnit = undefined;
                                updatedItem.amount = undefined;
                              } else if (newMethod === 'flat-rate') {
                                // Clear ROAS fields
                                updatedItem.marketingSpend = undefined;
                                updatedItem.targetROAS = undefined;
                                updatedItem.estimatedUnitsSold = undefined;
                                updatedItem.estimatedSellingPrice = undefined;
                                updatedItem.expectedRevenue = undefined;
                                updatedItem.manualCostPerUnit = undefined;
                              } else if (newMethod === 'manual') {
                                // Clear semua fields kecuali manualCostPerUnit
                                updatedItem.marketingSpend = undefined;
                                updatedItem.targetROAS = undefined;
                                updatedItem.estimatedUnitsSold = undefined;
                                updatedItem.estimatedSellingPrice = undefined;
                                updatedItem.expectedRevenue = undefined;
                                updatedItem.flatRate = undefined;
                                updatedItem.flatRateUnits = undefined;
                              }
                              
                              // Apply updates
                              setCostCategories(prev => prev.map(cat => {
                                if (cat.id === category.id) {
                                  return {
                                    ...cat,
                                    items: cat.items.map(it => {
                                      if (it.id === item.id) {
                                        return { ...it, ...updatedItem };
                                      }
                                      return it;
                                    })
                                  };
                                }
                                return cat;
                              }));
                            }}
                            className="flex gap-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="roas" id={`roas-${item.id}`} />
                              <Label htmlFor={`roas-${item.id}`} className="text-xs text-muted-foreground cursor-pointer">
                                ROAS-based (Recommended)
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="flat-rate" id={`flat-rate-${item.id}`} />
                              <Label htmlFor={`flat-rate-${item.id}`} className="text-xs text-muted-foreground cursor-pointer">
                                Flat Rate (seperti Overhead)
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="manual" id={`manual-${item.id}`} />
                              <Label htmlFor={`manual-${item.id}`} className="text-xs text-muted-foreground cursor-pointer">
                                Manual (Cost per Unit langsung)
                              </Label>
                            </div>
                          </RadioGroup>
                        </div>

                        {/* ROAS-based Calculation */}
                        {(!item.marketingCalculationMethod || item.marketingCalculationMethod === 'roas') && (
                          <div className="p-4 bg-primary/10 border border-primary/25 rounded-lg">
                            <div className="text-xs font-semibold text-primary mb-3">
                              Perhitungan Berbasis ROAS dengan Estimasi:
                            </div>
                            
                            <div className="grid grid-cols-3 gap-3 mb-3">
                              {/* Marketing Spend */}
                              <div>
                                <Label className="text-xs text-muted-foreground">Marketing Spend (per bulan)</Label>
                                <Input
                                  type="number"
                                  placeholder="0"
                                  value={item.marketingSpend || ''}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === '') {
                                      updateCostItem(category.id, item.id, 'marketingSpend', undefined);
                                    } else {
                                      updateCostItem(category.id, item.id, 'marketingSpend', parseFloat(value) || 0);
                                    }
                                  }}
                                  className="h-8 text-sm"
                                />
                                <div className="text-xs text-muted-foreground mt-1">
                                  {item.marketingSpend ? `Rp ${formatCurrency(item.marketingSpend)}` : 'Rp 0'}
                                </div>
                              </div>
                              
                              {/* Target ROAS */}
                              <div>
                                <Label className="text-xs text-muted-foreground">Target ROAS</Label>
                                <Input
                                  type="number"
                                  placeholder="3"
                                  step="0.1"
                                  value={item.targetROAS || ''}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === '') {
                                      updateCostItem(category.id, item.id, 'targetROAS', undefined);
                                    } else {
                                      updateCostItem(category.id, item.id, 'targetROAS', parseFloat(value) || 0);
                                    }
                                  }}
                                  className="h-8 text-sm"
                                />
                                <div className="text-xs text-muted-foreground mt-1">
                                  {item.targetROAS ? `${item.targetROAS}:1` : 'Contoh: 3:1'}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  ROAS 3:1 berarti setiap Rp 1 spend = Rp 3 revenue
                                </p>
                              </div>
                              
                              {/* Production Cost per Unit (tanpa marketing) - Read-only */}
                              <div>
                                <Label className="text-xs text-muted-foreground">Production Cost per Unit (tanpa marketing)</Label>
                                <Input
                                  type="number"
                                  placeholder="0"
                                  value={getProductionCostWithoutMarketing()}
                                  readOnly
                                  className="h-8 text-sm bg-muted"
                                />
                                <div className="text-xs text-muted-foreground mt-1">
                                  {getProductionCostWithoutMarketing() > 0 
                                    ? `Rp ${formatCurrency(getProductionCostWithoutMarketing())}` 
                                    : 'Hitung dari cost breakdown'}
                                </div>
                                <p className="text-xs text-muted-foreground/60 mt-1 italic">
                                  Auto dari cost breakdown (tanpa marketing). Digunakan untuk estimasi units sold (break-even point).
                                </p>
                                <p className="text-xs text-primary mt-1 font-semibold">
                                  Note: Selling price final akan dihitung di Pricing Settings dengan markup yang Anda input.
                                </p>
                              </div>
                            </div>
                            
                            {/* Auto-calculated values */}
                            {(item.marketingSpend && item.targetROAS && getProductionCostWithoutMarketing() > 0) && (
                              <div className="grid grid-cols-2 gap-3 mb-3 p-3 bg-white border border-primary/25 rounded">
                                {/* Expected Revenue */}
                                <div>
                                  <Label className="text-xs text-muted-foreground font-semibold">Expected Revenue</Label>
                                  <div className="h-8 flex items-center text-sm font-semibold text-primary">
                                    Rp {formatCurrency((item.marketingSpend || 0) * (item.targetROAS || 0))}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    = Marketing Spend × Target ROAS
                                  </p>
                                </div>
                                
                                {/* Estimated Selling Price */}
                                <div>
                                  <Label className="text-xs text-muted-foreground font-semibold">Estimated Selling Price (untuk estimasi)</Label>
                                  <div className="h-8 flex items-center text-sm font-semibold text-primary">
                                    Rp {formatCurrency(getProductionCostWithoutMarketing())}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    = Production Cost (break-even point)
                                  </p>
                                  <p className="text-xs text-muted-foreground/60 mt-1 italic">
                                    Hanya untuk estimasi. Selling price final di Pricing Settings.
                                  </p>
                                </div>
                                
                                {/* Estimasi Units Sold */}
                                <div>
                                  <Label className="text-xs text-muted-foreground font-semibold">Estimasi Units Sold</Label>
                                  <div className="h-8 flex items-center text-sm font-semibold text-primary">
                                    {(() => {
                                      const expectedRevenue = (item.marketingSpend || 0) * (item.targetROAS || 0);
                                      const productionCost = getProductionCostWithoutMarketing();
                                      const estimatedUnits = productionCost > 0 
                                        ? expectedRevenue / productionCost 
                                        : 0;
                                      return estimatedUnits > 0 
                                        ? `${formatCurrency(Math.round(estimatedUnits))} unit` 
                                        : '0 unit';
                                    })()}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    = Expected Revenue ÷ Production Cost
                                  </p>
                                </div>
                                
                                {/* Marketing Cost per Unit */}
                                <div>
                                  <Label className="text-xs text-muted-foreground font-semibold">Marketing Cost per Unit</Label>
                                  <div className="h-8 flex items-center text-sm font-semibold text-primary">
                                    Rp {formatCurrency(calculateItemTotal(item, category))}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    = Marketing Spend ÷ Estimasi Units Sold
                                  </p>
                                </div>
                              </div>
                            )}
                            
                            {/* Display detailed calculation breakdown */}
                            {(item.marketingSpend && item.targetROAS && getProductionCostWithoutMarketing() > 0) && (
                              <div className="mt-3 pt-3 border-t border-primary/30 space-y-1 text-xs">
                                <div className="text-xs text-primary bg-primary/15 p-3 rounded">
                                  <div className="font-semibold mb-2">Detail Perhitungan:</div>
                                  {(() => {
                                    const expectedRevenue = (item.marketingSpend || 0) * (item.targetROAS || 0);
                                    const productionCost = getProductionCostWithoutMarketing();
                                    const estimatedSellingPrice = productionCost; // Tanpa margin
                                    const estimatedUnitsSold = productionCost > 0 
                                      ? expectedRevenue / productionCost 
                                      : 0;
                                    const marketingCostPerUnit = estimatedUnitsSold > 0 
                                      ? (item.marketingSpend || 0) / estimatedUnitsSold 
                                      : 0;
                                    
                                    return (
                                      <>
                                        <div>• Marketing Spend: Rp {formatCurrency(item.marketingSpend || 0)}</div>
                                        <div>• Target ROAS: {item.targetROAS}:1</div>
                                        <div>• Production Cost (tanpa marketing): Rp {formatCurrency(productionCost)}</div>
                                        <div className="mt-2 pt-2 border-t border-primary/30">
                                          <div>• Expected Revenue = Rp {formatCurrency(item.marketingSpend || 0)} × {item.targetROAS} = Rp {formatCurrency(expectedRevenue)}</div>
                                          <div>• Estimated Selling Price = Rp {formatCurrency(productionCost)} (break-even point)</div>
                                          <div>• Estimasi Units Sold = Rp {formatCurrency(expectedRevenue)} ÷ Rp {formatCurrency(productionCost)} = {formatCurrency(Math.round(estimatedUnitsSold))} unit</div>
                                        </div>
                                        <div className="mt-2 pt-2 border-t border-primary/30 font-semibold">
                                          • Marketing Cost per Unit = Rp {formatCurrency(item.marketingSpend || 0)} ÷ {formatCurrency(Math.round(estimatedUnitsSold))} = Rp {formatCurrency(marketingCostPerUnit)}
                                        </div>
                                        <div className="mt-2 pt-2 border-t border-primary/30 text-xs text-muted-foreground italic">
                                          Note: Estimated Selling Price hanya untuk estimasi marketing cost. Selling price final akan dihitung di Pricing Settings dengan markup yang Anda input.
                                        </div>
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Flat Rate Calculation (fallback) */}
                        {item.marketingCalculationMethod === 'flat-rate' && (
                          <div className="p-4 bg-muted/50 border border-border rounded-lg">
                            <div className="text-xs font-semibold text-foreground mb-3">
                              Perhitungan Flat Rate:
                            </div>
                            <div className="grid grid-cols-4 gap-3">
                              <div>
                                <Label className="text-xs text-muted-foreground">Flat Rate</Label>
                                <Input
                                  type="number"
                                  placeholder="0"
                                  value={item.flatRate || ''}
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value.replace(/\./g, '')) || 0;
                                    updateCostItem(category.id, item.id, 'flatRate', value);
                                  }}
                                  className="h-8 text-sm"
                                />
                                <div className="text-xs text-muted-foreground mt-1">
                                  {item.flatRate ? `Rp ${formatCurrency(item.flatRate)}` : 'Rp 0'}
                                </div>
                              </div>
                              
                              <div>
                                <Label className="text-xs text-muted-foreground">Unit untuk Flat Rate</Label>
                                <Input
                                  type="number"
                                  placeholder="0"
                                  value={item.flatRateUnits || ''}
                                  onChange={(e) => updateCostItem(category.id, item.id, 'flatRateUnits', parseFloat(e.target.value) || 0)}
                                  className="h-8 text-sm"
                                />
                                <div className="text-xs text-muted-foreground mt-1">unit</div>
                              </div>
                              
                              <div>
                                <Label className="text-xs text-muted-foreground">Cost per Unit</Label>
                                <Input
                                  type="number"
                                  placeholder="0"
                                  step="0.01"
                                  value={item.manualCostPerUnit !== undefined ? item.manualCostPerUnit : (calculateItemTotal(item, category) || '')}
                                  onChange={(e) => {
                                    const inputValue = e.target.value;
                                    if (inputValue === '' || parseFloat(inputValue) === 0) {
                                      updateCostItem(category.id, item.id, 'manualCostPerUnit', undefined);
                                    } else {
                                      const value = parseFloat(inputValue) || 0;
                                      updateCostItem(category.id, item.id, 'manualCostPerUnit', value);
                                    }
                                  }}
                                  className="h-8 text-sm"
                                />
                                <div className="text-xs text-muted-foreground mt-1">
                                  {item.manualCostPerUnit !== undefined && item.manualCostPerUnit > 0 
                                    ? 'Manual override' 
                                    : `Rp ${formatCurrency(calculateItemTotal(item, category) || 0)}`}
                                </div>
                              </div>
                              
                              <div className="flex items-end">
                                <div className="w-full">
                                  <Label className="text-xs text-muted-foreground">Formula</Label>
                                  <div className="h-8 flex items-center text-xs text-muted-foreground">
                                    {item.flatRate && item.flatRateUnits 
                                      ? `${formatCurrency(item.flatRate)} ÷ ${formatCurrency(item.flatRateUnits)} = ${formatCurrency(calculateItemTotal(item, category) || 0)}`
                                      : 'Masukkan flat rate & unit'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Manual Calculation */}
                        {item.marketingCalculationMethod === 'manual' && (
                          <div className="p-4 bg-muted/50 border border-border rounded-lg">
                            <div className="text-xs font-semibold text-foreground mb-3">
                              Perhitungan Manual:
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Cost per Unit</Label>
                              <Input
                                type="number"
                                placeholder="0"
                                step="0.01"
                                value={item.manualCostPerUnit || ''}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value === '') {
                                    updateCostItem(category.id, item.id, 'manualCostPerUnit', undefined);
                                  } else {
                                    updateCostItem(category.id, item.id, 'manualCostPerUnit', parseFloat(value) || 0);
                                  }
                                }}
                                className="h-8 text-sm"
                              />
                              <div className="text-xs text-muted-foreground mt-1">
                                {item.manualCostPerUnit ? `Rp ${formatCurrency(item.manualCostPerUnit)}` : 'Rp 0'}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Section untuk perhitungan labor cost - hanya untuk labor category */}
                    {category.isLaborCategory && (
                      <div className="col-span-full mt-4 space-y-4">
                        {/* Radio buttons untuk pilih metode perhitungan */}
                        <div className="p-3 bg-muted/50 border border-border rounded-lg">
                          <Label className="text-xs font-semibold text-foreground mb-2 block">
                            Metode Perhitungan:
                          </Label>
                          <RadioGroup
                            value={item.calculationMethod || 'salary'}
                            onValueChange={(value) => {
                              const newMethod = value as 'salary' | 'vendor' | 'manual';
                              // Clear fields from other methods when switching
                              const updatedItem: Partial<CostItem> = {
                                calculationMethod: newMethod
                              };
                              
                              if (newMethod === 'salary') {
                                // Clear vendor and manual fields
                                updatedItem.vendorRate = undefined;
                                updatedItem.vendorTimePeriod = undefined;
                                updatedItem.unitsPerTimePeriod = undefined;
                                updatedItem.amount = undefined;
                                updatedItem.quantity = undefined;
                                updatedItem.timePeriod = undefined;
                                updatedItem.manualCostPerUnit = undefined;
                                // Keep salary fields (user will fill them)
                              } else if (newMethod === 'vendor') {
                                // Clear salary and manual fields
                                updatedItem.monthlySalary = undefined;
                                updatedItem.workingDaysPerMonth = undefined;
                                updatedItem.workingHoursPerDay = undefined;
                                updatedItem.hoursPerUnit = undefined;
                                updatedItem.amount = undefined;
                                updatedItem.quantity = undefined;
                                updatedItem.timePeriod = undefined;
                                updatedItem.manualCostPerUnit = undefined;
                                // Set default vendorTimePeriod if not set
                                if (!item.vendorTimePeriod) {
                                  updatedItem.vendorTimePeriod = 'hourly';
                                }
                              } else if (newMethod === 'manual') {
                                // Clear salary and vendor fields
                                updatedItem.monthlySalary = undefined;
                                updatedItem.workingDaysPerMonth = undefined;
                                updatedItem.workingHoursPerDay = undefined;
                                updatedItem.hoursPerUnit = undefined;
                                updatedItem.vendorRate = undefined;
                                updatedItem.vendorTimePeriod = undefined;
                                updatedItem.unitsPerTimePeriod = undefined;
                                updatedItem.manualCostPerUnit = undefined;
                                // Set default timePeriod if not set
                                if (!item.timePeriod) {
                                  updatedItem.timePeriod = 'hourly';
                                }
                              }
                              
                              // Apply all updates at once
                              setCostCategories(prev => prev.map(cat => {
                                if (cat.id === category.id) {
                                  return {
                                    ...cat,
                                    items: cat.items.map(it => {
                                      if (it.id === item.id) {
                                        return { ...it, ...updatedItem };
                                      }
                                      return it;
                                    })
                                  };
                                }
                                return cat;
                              }));
                            }}
                            className="flex gap-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="salary" id={`salary-${item.id}`} />
                              <Label htmlFor={`salary-${item.id}`} className="text-xs text-muted-foreground cursor-pointer">
                                Hitung dari Gaji Bulanan
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="vendor" id={`vendor-${item.id}`} />
                              <Label htmlFor={`vendor-${item.id}`} className="text-xs text-muted-foreground cursor-pointer">
                                Hitung dari Vendor/Robot
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="manual" id={`manual-${item.id}`} />
                              <Label htmlFor={`manual-${item.id}`} className="text-xs text-muted-foreground cursor-pointer">
                                Manual (Rate × Quantity)
                              </Label>
                            </div>
                          </RadioGroup>
                        </div>

                        {/* Versi 0: Manual Calculation */}
                        {item.calculationMethod === 'manual' && (
                          <div className="p-4 bg-muted/50 border border-border rounded-lg">
                            <div className="text-xs font-semibold text-foreground mb-3">
                              Perhitungan Manual (Rate × Quantity):
                            </div>
                            
                            <div className="grid grid-cols-4 gap-3">
                              {/* Waktu */}
                              <div>
                                <Label className="text-xs text-muted-foreground">Waktu</Label>
                                <Select
                                  value={item.timePeriod || 'hourly'}
                                  onValueChange={(value: 'hourly' | 'daily' | 'monthly') => updateCostItem(category.id, item.id, 'timePeriod', value)}
                                >
                                  <SelectTrigger className="h-8 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="hourly">Per Jam</SelectItem>
                                    <SelectItem value="daily">Per Hari</SelectItem>
                                    <SelectItem value="monthly">Per Bulan</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              {/* Rate */}
                              <div>
                                <Label className="text-xs text-muted-foreground">Rate</Label>
                                <Input
                                  type="number"
                                  placeholder="100.000"
                                  value={item.amount || ''}
                                  onChange={(e) => updateCostItem(category.id, item.id, 'amount', parseFloat(e.target.value) || 0)}
                                  className="h-8 text-sm"
                                />
                                <div className="text-xs text-muted-foreground mt-1">
                                  Rp/{getTimePeriodLabel(item.timePeriod || 'hourly').toLowerCase()}
                                </div>
                              </div>
                              
                              {/* Quantity */}
                              <div>
                                <Label className="text-xs text-muted-foreground">Quantity</Label>
                                <Input
                                  type="number"
                                  placeholder="0.02"
                                  step="0.01"
                                  value={item.quantity || ''}
                                  onChange={(e) => updateCostItem(category.id, item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                  className="h-8 text-sm"
                                />
                                <div className="text-xs text-muted-foreground mt-1">
                                  {getQuantityLabel(item.timePeriod || 'hourly')}
                                </div>
                              </div>
                              
                              {/* Cost per Unit */}
                              <div>
                                <Label className="text-xs text-muted-foreground">Cost per Unit</Label>
                                <Input
                                  type="number"
                                  placeholder="0"
                                  step="0.01"
                                  value={item.manualCostPerUnit !== undefined ? item.manualCostPerUnit : (calculateItemTotal(item, category) || '')}
                                  onChange={(e) => {
                                    const inputValue = e.target.value;
                                    // Jika kosong atau 0, set ke undefined agar kembali ke auto calculation
                                    if (inputValue === '' || parseFloat(inputValue) === 0) {
                                      updateCostItem(category.id, item.id, 'manualCostPerUnit', undefined);
                                    } else {
                                      const value = parseFloat(inputValue) || 0;
                                      updateCostItem(category.id, item.id, 'manualCostPerUnit', value);
                                    }
                                  }}
                                  className="h-8 text-sm"
                                />
                                <div className="text-xs text-muted-foreground mt-1">
                                  {item.manualCostPerUnit !== undefined && item.manualCostPerUnit > 0 ? 'Manual override' : 'Auto (Rate × Quantity)'}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Versi 1: Hitung dari Gaji Bulanan */}
                        {(item.calculationMethod === 'salary' || (!item.calculationMethod)) && (
                          <div className="p-4 bg-brand-red/5 border border-brand-red/20 rounded-lg">
                            <div className="text-xs font-semibold text-brand-red mb-3">
                              Hitung dari Gaji Bulanan:
                            </div>
                            
                            <div className="grid grid-cols-4 gap-3">
                              {/* Gaji Bulanan */}
                              <div>
                                <Label className="text-xs text-muted-foreground">Gaji Bulanan</Label>
                                <Input
                                  type="number"
                                  placeholder="8.000.000"
                                  value={item.monthlySalary || ''}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === '') {
                                      updateCostItem(category.id, item.id, 'monthlySalary', undefined);
                                    } else {
                                      updateCostItem(category.id, item.id, 'monthlySalary', parseFloat(value) || 0);
                                    }
                                  }}
                                  className="h-8 text-sm"
                                />
                              </div>
                              
                              {/* Hari Kerja/Bulan */}
                              <div>
                                <Label className="text-xs text-muted-foreground">Hari Kerja/Bulan</Label>
                                <Input
                                  type="number"
                                  placeholder="22"
                                  value={item.workingDaysPerMonth || ''}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === '') {
                                      updateCostItem(category.id, item.id, 'workingDaysPerMonth', undefined);
                                    } else {
                                      updateCostItem(category.id, item.id, 'workingDaysPerMonth', parseFloat(value) || 0);
                                    }
                                  }}
                                  className="h-8 text-sm"
                                />
                              </div>
                              
                              {/* Jam Kerja/Hari */}
                              <div>
                                <Label className="text-xs text-muted-foreground">Jam Kerja/Hari</Label>
                                <Input
                                  type="number"
                                  placeholder="8"
                                  value={item.workingHoursPerDay || ''}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === '') {
                                      updateCostItem(category.id, item.id, 'workingHoursPerDay', undefined);
                                    } else {
                                      updateCostItem(category.id, item.id, 'workingHoursPerDay', parseFloat(value) || 0);
                                    }
                                  }}
                                  className="h-8 text-sm"
                                />
                              </div>
                              
                              {/* Jam Kerja/Unit */}
                              <div>
                                <Label className="text-xs text-muted-foreground">Jam Kerja/Unit</Label>
                                <Input
                                  type="number"
                                  placeholder="0.02"
                                  step="0.01"
                                  value={item.hoursPerUnit || ''}
                                  onChange={(e) => updateCostItem(category.id, item.id, 'hoursPerUnit', parseFloat(e.target.value) || 0)}
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>
                            
                            {/* Display calculated values */}
                            {(item.monthlySalary && item.workingDaysPerMonth && item.workingHoursPerDay && item.hoursPerUnit) && (
                              <div className="mt-3 pt-3 border-t border-brand-red/25 space-y-1 text-xs">
                                <div className="flex justify-between text-muted-foreground">
                                  <span>Cost per Jam:</span>
                                  <span className="font-semibold">
                                    Rp {formatCurrency((item.monthlySalary || 0) / ((item.workingDaysPerMonth || 22) * (item.workingHoursPerDay || 8)))}
                                  </span>
                                </div>
                                <div className="flex justify-between text-foreground font-medium">
                                  <span>Cost per Unit (dari gaji):</span>
                                  <span>
                                    Rp {formatCurrency(calculateItemTotal(item, category))}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Versi 2: Hitung dari Vendor/Robot */}
                        {item.calculationMethod === 'vendor' && (
                          <div className="p-4 bg-brand-blue-soft border border-brand-blue/25 rounded-lg">
                            <div className="text-xs font-semibold text-brand-blue-deep mb-3">
                              Hitung dari Vendor/Robot/Mesin:
                            </div>
                            
                            <div className="grid grid-cols-3 gap-3">
                              {/* Waktu */}
                              <div>
                                <Label className="text-xs text-muted-foreground">Waktu</Label>
                                <Select
                                  value={item.vendorTimePeriod || 'hourly'}
                                  onValueChange={(value: 'hourly' | 'daily' | 'monthly') => updateCostItem(category.id, item.id, 'vendorTimePeriod', value)}
                                >
                                  <SelectTrigger className="h-8 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="hourly">Per Jam</SelectItem>
                                    <SelectItem value="daily">Per Hari</SelectItem>
                                    <SelectItem value="monthly">Per Bulan</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              {/* Rate */}
                              <div>
                                <Label className="text-xs text-muted-foreground">Rate</Label>
                                <Input
                                  type="number"
                                  placeholder="100.000"
                                  value={item.vendorRate !== undefined && item.vendorRate > 0 ? item.vendorRate : ''}
                                  onChange={(e) => {
                                    const inputValue = e.target.value;
                                    if (inputValue === '' || inputValue === null || inputValue === undefined) {
                                      updateCostItem(category.id, item.id, 'vendorRate', 0);
                                    } else {
                                      const numValue = parseFloat(inputValue);
                                      updateCostItem(category.id, item.id, 'vendorRate', isNaN(numValue) ? 0 : numValue);
                                    }
                                  }}
                                  className="h-8 text-sm"
                                />
                                <div className="text-xs text-muted-foreground mt-1">
                                  Rp/{getTimePeriodLabel(item.vendorTimePeriod || 'hourly').toLowerCase()}
                                </div>
                              </div>
                              
                              {/* Unit per Waktu */}
                              <div>
                                <Label className="text-xs text-muted-foreground">Unit per {getTimePeriodLabel(item.vendorTimePeriod || 'hourly')}</Label>
                                <Input
                                  type="number"
                                  placeholder="500"
                                  step="0.01"
                                  value={item.unitsPerTimePeriod !== undefined && item.unitsPerTimePeriod > 0 ? item.unitsPerTimePeriod : ''}
                                  onChange={(e) => {
                                    const inputValue = e.target.value;
                                    if (inputValue === '' || inputValue === null || inputValue === undefined) {
                                      updateCostItem(category.id, item.id, 'unitsPerTimePeriod', 0);
                                    } else {
                                      const numValue = parseFloat(inputValue);
                                      updateCostItem(category.id, item.id, 'unitsPerTimePeriod', isNaN(numValue) ? 0 : numValue);
                                    }
                                  }}
                                  className="h-8 text-sm"
                                />
                                <div className="text-xs text-muted-foreground mt-1">
                                  unit/{getTimePeriodLabel(item.vendorTimePeriod || 'hourly').toLowerCase()}
                                </div>
                              </div>
                            </div>
                            
                            {/* Display calculated values */}
                            {(item.vendorRate !== undefined && item.vendorRate > 0 && item.vendorTimePeriod && item.unitsPerTimePeriod !== undefined && item.unitsPerTimePeriod > 0) && (
                              <div className="mt-3 pt-3 border-t border-brand-blue/30 space-y-1 text-xs">
                                <div className="flex justify-between text-muted-foreground">
                                  <span>Cost per Unit (dari vendor):</span>
                                  <span className="font-semibold text-foreground">
                                    Rp {formatCurrency(calculateItemTotal(item, category))}
                                  </span>
                                </div>
                                <div className="text-xs text-brand-blue mt-1 bg-brand-blue-soft p-2 rounded">
                                  <div className="font-semibold mb-1">Perhitungan:</div>
                                  {(() => {
                                    const timePeriod = item.vendorTimePeriod || 'hourly';
                                    let ratePerHour = 0;
                                    let unitsPerHour = 0;
                                    
                                    if (timePeriod === 'hourly') {
                                      ratePerHour = item.vendorRate || 0;
                                      unitsPerHour = item.unitsPerTimePeriod || 0;
                                    } else if (timePeriod === 'daily') {
                                      ratePerHour = (item.vendorRate || 0) / 8;
                                      unitsPerHour = (item.unitsPerTimePeriod || 0) / 8;
                                    } else if (timePeriod === 'monthly') {
                                      ratePerHour = (item.vendorRate || 0) / (22 * 8);
                                      unitsPerHour = (item.unitsPerTimePeriod || 0) / (22 * 8);
                                    }
                                    
                                    const costPerUnit = unitsPerHour > 0 ? ratePerHour / unitsPerHour : 0;
                                    
                                    return (
                                      <>
                                        <div>• Rate per {getTimePeriodLabel(timePeriod)}: Rp {formatCurrency(item.vendorRate || 0)}</div>
                                        <div>• Unit per {getTimePeriodLabel(timePeriod)}: {formatCurrency(item.unitsPerTimePeriod || 0)} unit</div>
                                        {timePeriod !== 'hourly' && (
                                          <>
                                            <div className="mt-1 pt-1 border-t border-brand-blue/30">• Rate per jam: Rp {formatCurrency(ratePerHour)}</div>
                                            <div>• Unit per jam: {formatCurrency(unitsPerHour)} unit</div>
                                          </>
                                        )}
                                        <div className="mt-1 pt-1 border-t border-brand-blue/30 font-semibold">
                                          • Cost per Unit = Rp {formatCurrency(ratePerHour)} ÷ {formatCurrency(unitsPerHour)} = Rp {formatCurrency(costPerUnit)}
                                        </div>
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                
                {/* Category Total */}
                <div className="bg-muted/50 p-2 rounded flex justify-between items-center">
                  <span className="text-sm font-medium text-foreground">
                    {category.title} Total:
                  </span>
                  <span className="text-sm font-bold text-foreground">
                    Rp {formatCurrency(getCategoryTotal(category))}
                  </span>
                </div>
              </div>
            )}

            {category.items.length === 0 && (
              <div className="text-center py-4 text-muted-foreground/60 text-sm border-2 border-dashed border-border rounded-lg">
                No items added yet. Click "Add Item" to start.
              </div>
            )}
          </div>
        ))}

        <Separator />
        
        {/* Grand Total */}
        <div className="bg-brand-blue-soft p-4 rounded-lg border border-brand-blue/25 space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-brand-blue-deep">Production Cost per Unit:</span>
            <span className="text-lg font-bold text-brand-blue-deep">
              Rp {formatCurrency(getGrandTotal())}
            </span>
          </div>
          <div className="text-xs text-brand-blue-on-soft mt-1">
            * Biaya produksi per unit. Total biaya akan dihitung berdasarkan unit yang diperlukan untuk mencapai target (break-even atau target profit).
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
