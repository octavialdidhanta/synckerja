import { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group';
import { Separator } from '@/shared/components/ui/separator';
import { Package, Calculator, Check, ChevronRight, AlertTriangle, Target, TrendingUp, ArrowRight } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { DynamicCostBreakdown } from './DynamicCostBreakdown';
import { BusinessExpensesForm } from './BusinessExpensesForm';
import { SalesChannelManager } from './SalesChannelManager';
import { TargetCalculationResults } from './TargetCalculationResults';
import { MarketingCostsForm } from './MarketingCostsForm';
import { FinalSummary } from './FinalSummary';
import {
  PricingCalculationInput,
  PricingCalculationResult,
  BusinessExpenseItem,
  SalesChannel,
  TimePeriod,
  CostAllocationMethod,
  CalculationMethod,
  CostCategory,
} from '../types/pricingTypes';
import { calculatePricing } from '../lib/pricingCalculationEngine';
import { formatRupiah, formatNumber, formatInputNumber, parseInputNumber, calculateRecommendedMarketingSpend, calculateFinalUnitsWithMarketingSpend, MarketingRecommendation } from '../lib/pricingUtils';
import { SavedCalculation } from '../hooks/usePricingCalculations';
import { LoadTemplateModal } from './LoadTemplateModal';

interface StepChangeData {
  currentStep: number;
  finalSellingPrice?: number;
  marketingCostPerUnit?: number;
  channelFeePercent?: number;
  baseTotalCostPerUnit?: number;
}

interface PricingWizardProps {
  onCalculate?: (results: PricingCalculationResult, input: PricingCalculationInput) => void;
  onStepChange?: (data: StepChangeData) => void;
}

export interface PricingWizardRef {
  loadCalculation: (calculation: SavedCalculation) => void;
  resetForm: () => void;
}

export const PricingWizard = forwardRef<PricingWizardRef, PricingWizardProps>(
  ({ onCalculate, onStepChange }, ref) => {
  const { t } = useAppTranslation();
  
  const STEPS = [
    { id: 1, name: 'Product', label: t('pricingTools.wizard.steps.product', 'Product Info') },
    { id: 2, name: 'Costs', label: t('pricingTools.wizard.steps.costs', 'Production Costs') },
    { id: 3, name: 'Expenses', label: t('pricingTools.wizard.steps.expenses', 'Business Expenses') },
    { id: 4, name: 'Channels', label: t('pricingTools.wizard.steps.channels', 'Sales Channels') },
    { id: 5, name: 'Pricing', label: t('pricingTools.wizard.steps.pricing', 'Pricing Settings') },
    { id: 6, name: 'Summary', label: t('pricingTools.wizard.steps.summary', 'Final Summary') },
  ];
  const [currentStep, setCurrentStep] = useState(1);
  const [calculationResult, setCalculationResult] = useState<PricingCalculationResult | null>(null);
  const [loadKey, setLoadKey] = useState<string>(''); // Key untuk force re-render komponen child

  // Form state
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('');
  
  // Production costs (from DynamicCostBreakdown) - sekarang cost per unit
  const [productionCostPerUnit, setProductionCostPerUnit] = useState<number>(0);
  const [initialCostBreakdown, setInitialCostBreakdown] = useState<CostCategory[] | undefined>();
  const [costBreakdown, setCostBreakdown] = useState<CostCategory[] | undefined>();
  
  // Business expenses
  const [operationalExpenses, setOperationalExpenses] = useState<BusinessExpenseItem[]>([]);
  const [totalOperationalExpenses, setTotalOperationalExpenses] = useState<number>(0);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('monthly');
  const [costAllocationMethod, setCostAllocationMethod] = useState<CostAllocationMethod>('fixed-cost');
  const [initialExpenses, setInitialExpenses] = useState<BusinessExpenseItem[] | undefined>();
  
  // Sales channels
  const [salesChannels, setSalesChannels] = useState<SalesChannel[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [initialChannels, setInitialChannels] = useState<SalesChannel[] | undefined>();
  
  // Pricing settings
  const [calculationMethod, setCalculationMethod] = useState<CalculationMethod>('markup');
  const [markupPercent, setMarkupPercent] = useState<number>(50);
  const [marginPercent, setMarginPercent] = useState<number>(30);
  const [fixedProfit, setFixedProfit] = useState<number>(0);
  const [targetProfitPercent, setTargetProfitPercent] = useState<number>(10);
  const [minimumMarginPercent, setMinimumMarginPercent] = useState<number>(15);
  
  // Marketing costs (moved to Step 5)
  const [marketingSpend, setMarketingSpend] = useState<number>(0);
  const [marketingSpendDisplay, setMarketingSpendDisplay] = useState<string>('');
  const [targetROAS, setTargetROAS] = useState<number>(2);
  const [targetROASDisplay, setTargetROASDisplay] = useState<string>('');
  const [marketingCostPerUnit, setMarketingCostPerUnit] = useState<number>(0);
  // Calculated values from Marketing Results
  const [calculatedFinalSellingPrice, setCalculatedFinalSellingPrice] = useState<number>(0);
  const [calculatedMarketingCostPerUnit, setCalculatedMarketingCostPerUnit] = useState<number>(0);
  const [preliminaryResult, setPreliminaryResult] = useState<PricingCalculationResult | null>(null);
  
  // Marketing recommendations (NEW)
  const [breakEvenRecommendation, setBreakEvenRecommendation] = useState<any>(null);
  const [targetProfitRecommendation, setTargetProfitRecommendation] = useState<any>(null);
  
  // Track which calculations have been performed
  const [hasCalculatedBreakEven, setHasCalculatedBreakEven] = useState<boolean>(false);
  const [hasCalculatedTargetProfit, setHasCalculatedTargetProfit] = useState<boolean>(false);

  // Update selected channels when channels change
  useEffect(() => {
    const activeChannels = salesChannels.filter(c => c.isActive).map(c => c.id);
    setSelectedChannels(prev => {
      // Keep selected channels that are still active
      const validSelected = prev.filter(id => activeChannels.includes(id));
      return validSelected.length > 0 ? validSelected : activeChannels;
    });
  }, [salesChannels]);

  // Recalculate marketing recommendations when targetROAS changes (if calculation already exists)
  useEffect(() => {
    if (calculationResult && targetROAS > 0) {
      // Get recommended channel fee percent
      const recommendedChannelId = calculationResult.summary.recommendedChannel 
        ? calculationResult.channelPricing.find(c => c.channelName === calculationResult.summary.recommendedChannel)?.channelId
        : null;
      const recommendedChannel = salesChannels.find(c => c.id === recommendedChannelId);
      const channelFeePercent = recommendedChannel?.totalFeePercent || 0;
      
      let breakEvenRec: MarketingRecommendation | null = null;
      let targetProfitRec: MarketingRecommendation | null = null;
      
      // Calculate Break-Even Recommendation
      if (calculationResult.breakEven.unitsRequired > 0 && calculationResult.breakEven.unitsRequired !== Infinity) {
        breakEvenRec = calculateRecommendedMarketingSpend(
          calculationResult.breakEven.unitsRequired,
          calculationResult.baseSellingPrice,
          calculationResult.totalCostPerUnit,
          totalOperationalExpenses,
          channelFeePercent,
          targetROAS,
          costAllocationMethod,
          timePeriod
        );
      }
      
      // Calculate Target Profit Recommendation
      if (calculationResult.targetProfit && calculationResult.targetProfit.unitsRequired > 0 && calculationResult.targetProfit.unitsRequired !== Infinity) {
        targetProfitRec = calculateRecommendedMarketingSpend(
          calculationResult.targetProfit.unitsRequired,
          calculationResult.baseSellingPrice,
          calculationResult.totalCostPerUnit,
          totalOperationalExpenses,
          channelFeePercent,
          targetROAS,
          costAllocationMethod,
          timePeriod,
          calculationResult.targetProfit.targetProfitAmount || 0
        );
      }
      
      setBreakEvenRecommendation(breakEvenRec);
      setTargetProfitRecommendation(targetProfitRec);
      
      // Update marketing spend default
      if (targetProfitRec) {
        const recommendedSpend = Math.round(targetProfitRec.recommendedMarketingSpend);
        setMarketingSpend(recommendedSpend);
        setMarketingSpendDisplay(formatInputNumber(recommendedSpend));
      } else if (breakEvenRec) {
        const recommendedSpend = Math.round(breakEvenRec.recommendedMarketingSpend);
        setMarketingSpend(recommendedSpend);
        setMarketingSpendDisplay(formatInputNumber(recommendedSpend));
      }
    } else if (targetROAS === 0) {
      // Clear recommendations when ROAS is 0
      setBreakEvenRecommendation(null);
      setTargetProfitRecommendation(null);
    }
  }, [targetROAS, calculationResult, salesChannels, totalOperationalExpenses, costAllocationMethod, timePeriod]);

  // Auto-update preliminaryResult when pricing settings change (only when calculation already exists)
  // This ensures Final Summary always shows the latest data from step 5
  useEffect(() => {
    // Only recalculate if we have a preliminary result (calculation was done before)
    // and we're on step 5 or step 6 (to keep Final Summary updated)
    if (preliminaryResult && (currentStep === 5 || currentStep === 6)) {
      const input: PricingCalculationInput = {
        productName,
        category,
        costBreakdown: costBreakdown || initialCostBreakdown,
        productionCostPerUnit,
        operationalExpenses,
        totalOperationalExpenses,
        costAllocationMethod,
        timePeriod,
        calculationMethod,
        markupPercent: calculationMethod === 'markup' ? markupPercent : undefined,
        marginPercent: calculationMethod === 'margin' ? marginPercent : undefined,
        fixedProfit: calculationMethod === 'fixed' ? fixedProfit : undefined,
        salesChannels,
        selectedChannels,
        targetProfitPercent,
        minimumMarginPercent,
      };

      const results = calculatePricing(input);
      results.isPreliminary = true;
      results.preliminaryResults = {
        baseSellingPrice: results.baseSellingPrice,
        totalCostPerUnit: results.totalCostPerUnit,
        breakEven: results.breakEven,
        targetProfit: results.targetProfit,
      };
      
      setCalculationResult(results);
      setPreliminaryResult(results);
    }
  }, [
    currentStep,
    calculationMethod,
    markupPercent,
    marginPercent,
    fixedProfit,
    targetProfitPercent,
    minimumMarginPercent,
    productionCostPerUnit,
    totalOperationalExpenses,
    costAllocationMethod,
    salesChannels,
    selectedChannels,
    timePeriod,
    // Note: We intentionally don't include preliminaryResult in deps to avoid infinite loop
    // Instead, we check if it exists in the effect body
  ]);

  // Notify parent when step changes and calculate finalSellingPrice when marketing data is available
  useEffect(() => {
    if (onStepChange) {
      let stepData: StepChangeData = {
        currentStep,
      };
      
      // When Marketing Results are calculated, send data to sidebar
      if (preliminaryResult && calculatedFinalSellingPrice > 0 && calculatedMarketingCostPerUnit > 0) {
        // Use calculated values from Marketing Results
        const recommendedChannelId = preliminaryResult.summary.recommendedChannel
          ? preliminaryResult.channelPricing.find(c => c.channelName === preliminaryResult.summary.recommendedChannel)?.channelId
          : null;
        const recommendedChannel = salesChannels.find(c => c.id === recommendedChannelId);
        const channelFeePercent = recommendedChannel?.totalFeePercent || 0;
        
        stepData = {
          currentStep,
          finalSellingPrice: calculatedFinalSellingPrice,
          marketingCostPerUnit: calculatedMarketingCostPerUnit,
          channelFeePercent,
          baseTotalCostPerUnit: preliminaryResult.totalCostPerUnit,
        };
      } else if (currentStep === 5 && preliminaryResult && marketingSpend > 0 && targetROAS > 0) {
        // Fallback: when step 5 is active and marketing data is available, use simple calculation
        const finalSellingPrice = preliminaryResult.baseSellingPrice + marketingCostPerUnit;
        
        // Get channel fee percent from recommended channel
        const recommendedChannelId = preliminaryResult.summary.recommendedChannel
          ? preliminaryResult.channelPricing.find(c => c.channelName === preliminaryResult.summary.recommendedChannel)?.channelId
          : null;
        const recommendedChannel = salesChannels.find(c => c.id === recommendedChannelId);
        const channelFeePercent = recommendedChannel?.totalFeePercent || 0;
        
        stepData = {
          currentStep,
          finalSellingPrice,
          marketingCostPerUnit,
          channelFeePercent,
          baseTotalCostPerUnit: preliminaryResult.totalCostPerUnit,
        };
      }
      
      onStepChange(stepData);
    }
  }, [currentStep, preliminaryResult, marketingCostPerUnit, marketingSpend, targetROAS, calculatedFinalSellingPrice, calculatedMarketingCostPerUnit, salesChannels, onStepChange]);

  // Update calculated values from Marketing Results when marketing data changes
  useEffect(() => {
    if (calculationResult && marketingSpend > 0 && targetROAS > 0) {
      // Calculate expected revenue
      const expectedRevenue = marketingSpend * targetROAS;
      
      // Calculate marketing cost per unit and final selling price using iteration
      let estimatedUnitsSold = calculationResult.baseSellingPrice > 0 
        ? expectedRevenue / calculationResult.baseSellingPrice 
        : 0;
      let calcMarketingCostPerUnit = 0;
      let calcFinalSellingPrice = calculationResult.baseSellingPrice;
      
      // Iterate to converge (max 10 iterations)
      for (let i = 0; i < 10; i++) {
        if (estimatedUnitsSold <= 0) break;
        
        calcMarketingCostPerUnit = marketingSpend / estimatedUnitsSold;
        calcFinalSellingPrice = calculationResult.baseSellingPrice + calcMarketingCostPerUnit;
        
        const newEstimatedUnitsSold = calcFinalSellingPrice > 0 
          ? expectedRevenue / calcFinalSellingPrice 
          : 0;
        
        if (Math.abs(newEstimatedUnitsSold - estimatedUnitsSold) < 0.01) {
          estimatedUnitsSold = newEstimatedUnitsSold;
          break;
        }
        
        estimatedUnitsSold = newEstimatedUnitsSold;
      }
      
      // Update state with calculated values only if different (to avoid infinite loops)
      if (Math.abs(calcFinalSellingPrice - calculatedFinalSellingPrice) > 0.01 || 
          Math.abs(calcMarketingCostPerUnit - calculatedMarketingCostPerUnit) > 0.01) {
        setCalculatedFinalSellingPrice(calcFinalSellingPrice);
        setCalculatedMarketingCostPerUnit(calcMarketingCostPerUnit);
      }
    } else {
      // Reset when marketing data is cleared
      if (calculatedFinalSellingPrice !== 0 || calculatedMarketingCostPerUnit !== 0) {
        setCalculatedFinalSellingPrice(0);
        setCalculatedMarketingCostPerUnit(0);
      }
    }
  }, [calculationResult, marketingSpend, targetROAS]);

  const handleProductionCostChange = useCallback((costPerUnit: number) => {
    setProductionCostPerUnit(costPerUnit);
  }, []);

  const handleCostBreakdownChange = useCallback((breakdown: CostCategory[]) => {
    setCostBreakdown(breakdown);
  }, []);

  const handleExpensesChange = useCallback((expenses: BusinessExpenseItem[], total: number) => {
    setOperationalExpenses(expenses);
    setTotalOperationalExpenses(total);
  }, []);

  const handleChannelsChange = useCallback((channels: SalesChannel[]) => {
    setSalesChannels(channels);
  }, []);

  // Helper function to perform calculation
  const performCalculation = (includeTargetProfit: boolean = true) => {
    const input: PricingCalculationInput = {
      productName,
      category,
      costBreakdown: costBreakdown || initialCostBreakdown,
      productionCostPerUnit,
      operationalExpenses,
      totalOperationalExpenses,
      costAllocationMethod,
      timePeriod,
      calculationMethod,
      markupPercent: calculationMethod === 'markup' ? markupPercent : undefined,
      marginPercent: calculationMethod === 'margin' ? marginPercent : undefined,
      fixedProfit: calculationMethod === 'fixed' ? fixedProfit : undefined,
      salesChannels,
      selectedChannels,
      targetProfitPercent: includeTargetProfit ? targetProfitPercent : undefined,
      minimumMarginPercent,
    };

    const results = calculatePricing(input);
    // Mark as preliminary (without marketing)
    results.isPreliminary = true;
    results.preliminaryResults = {
      baseSellingPrice: results.baseSellingPrice,
      totalCostPerUnit: results.totalCostPerUnit,
      breakEven: results.breakEven,
      targetProfit: results.targetProfit,
    };
    
    return results;
  };

  // Calculate only Break-Even Analysis (for "Calculate Selling Price" button)
  const handleCalculateBreakEven = () => {
    const results = performCalculation(false); // Don't include target profit calculation
    
    // Calculate Recommended Marketing Spend for Break-Even if target ROAS is set
    let breakEvenRec: MarketingRecommendation | null = null;
    
    if (targetROAS > 0) {
      // Get recommended channel fee percent
      const recommendedChannelId = results.summary.recommendedChannel 
        ? results.channelPricing.find(c => c.channelName === results.summary.recommendedChannel)?.channelId
        : null;
      const recommendedChannel = salesChannels.find(c => c.id === recommendedChannelId);
      const channelFeePercent = recommendedChannel?.totalFeePercent || 0;
      
      // Calculate Break-Even Recommendation
      if (results.breakEven.unitsRequired > 0 && results.breakEven.unitsRequired !== Infinity) {
        breakEvenRec = calculateRecommendedMarketingSpend(
          results.breakEven.unitsRequired,
          results.baseSellingPrice,
          results.totalCostPerUnit,
          totalOperationalExpenses,
          channelFeePercent,
          targetROAS,
          costAllocationMethod,
          timePeriod
        );
      }
    }
    
    setBreakEvenRecommendation(breakEvenRec);
    setCalculationResult(results);
    setPreliminaryResult(results);
    setHasCalculatedBreakEven(true);
    
    const input: PricingCalculationInput = {
      productName,
      category,
      costBreakdown: costBreakdown || initialCostBreakdown,
      productionCostPerUnit,
      operationalExpenses,
      totalOperationalExpenses,
      costAllocationMethod,
      timePeriod,
      calculationMethod,
      markupPercent: calculationMethod === 'markup' ? markupPercent : undefined,
      marginPercent: calculationMethod === 'margin' ? marginPercent : undefined,
      fixedProfit: calculationMethod === 'fixed' ? fixedProfit : undefined,
      salesChannels,
      selectedChannels,
      targetProfitPercent: undefined,
      minimumMarginPercent,
    };
    
    if (onCalculate) {
      onCalculate(results, input);
    }
  };

  // Calculate Target Profit Analysis (for "Calculate Target Sales" button)
  const handleCalculateTargetProfit = () => {
    const results = performCalculation(true); // Include target profit calculation
    
    // Calculate Recommended Marketing Spend for Target Profit if target ROAS is set
    let targetProfitRec: MarketingRecommendation | null = null;
    
    if (targetROAS > 0) {
      // Get recommended channel fee percent
      const recommendedChannelId = results.summary.recommendedChannel 
        ? results.channelPricing.find(c => c.channelName === results.summary.recommendedChannel)?.channelId
        : null;
      const recommendedChannel = salesChannels.find(c => c.id === recommendedChannelId);
      const channelFeePercent = recommendedChannel?.totalFeePercent || 0;
      
      // Calculate Target Profit Recommendation
      if (results.targetProfit && results.targetProfit.unitsRequired > 0 && results.targetProfit.unitsRequired !== Infinity) {
        targetProfitRec = calculateRecommendedMarketingSpend(
          results.targetProfit.unitsRequired,
          results.baseSellingPrice,
          results.totalCostPerUnit,
          totalOperationalExpenses,
          channelFeePercent,
          targetROAS,
          costAllocationMethod,
          timePeriod,
          results.targetProfit.targetProfitAmount || 0 // Include target profit amount
        );
      }
      
      // Use target profit recommendation as default for marketing spend
      if (targetProfitRec) {
        const recommendedSpend = Math.round(targetProfitRec.recommendedMarketingSpend);
        setMarketingSpend(recommendedSpend);
        setMarketingSpendDisplay(formatInputNumber(recommendedSpend));
      }
    }
    
    setTargetProfitRecommendation(targetProfitRec);
    setCalculationResult(results);
    setPreliminaryResult(results);
    setHasCalculatedTargetProfit(true);
    
    const input: PricingCalculationInput = {
      productName,
      category,
      costBreakdown: costBreakdown || initialCostBreakdown,
      productionCostPerUnit,
      operationalExpenses,
      totalOperationalExpenses,
      costAllocationMethod,
      timePeriod,
      calculationMethod,
      markupPercent: calculationMethod === 'markup' ? markupPercent : undefined,
      marginPercent: calculationMethod === 'margin' ? marginPercent : undefined,
      fixedProfit: calculationMethod === 'fixed' ? fixedProfit : undefined,
      salesChannels,
      selectedChannels,
      targetProfitPercent,
      minimumMarginPercent,
    };
    
    if (onCalculate) {
      onCalculate(results, input);
    }
  };

  const handleCalculate = () => {
    const input: PricingCalculationInput = {
      productName,
      category,
      costBreakdown: costBreakdown || initialCostBreakdown,
      productionCostPerUnit,
      operationalExpenses,
      totalOperationalExpenses,
      costAllocationMethod,
      timePeriod,
      calculationMethod,
      markupPercent: calculationMethod === 'markup' ? markupPercent : undefined,
      marginPercent: calculationMethod === 'margin' ? marginPercent : undefined,
      fixedProfit: calculationMethod === 'fixed' ? fixedProfit : undefined,
      salesChannels,
      selectedChannels,
      targetProfitPercent,
      minimumMarginPercent,
    };

    const results = calculatePricing(input);
    // Mark as preliminary (without marketing)
    results.isPreliminary = true;
    results.preliminaryResults = {
      baseSellingPrice: results.baseSellingPrice,
      totalCostPerUnit: results.totalCostPerUnit,
      breakEven: results.breakEven,
      targetProfit: results.targetProfit,
    };
    
    // Calculate Recommended Marketing Spend if target ROAS is set
    let breakEvenRec: MarketingRecommendation | null = null;
    let targetProfitRec: MarketingRecommendation | null = null;
    
    if (targetROAS > 0) {
      // Get recommended channel fee percent
      const recommendedChannelId = results.summary.recommendedChannel 
        ? results.channelPricing.find(c => c.channelName === results.summary.recommendedChannel)?.channelId
        : null;
      const recommendedChannel = salesChannels.find(c => c.id === recommendedChannelId);
      const channelFeePercent = recommendedChannel?.totalFeePercent || 0;
      
      // Calculate Break-Even Recommendation
      if (results.breakEven.unitsRequired > 0 && results.breakEven.unitsRequired !== Infinity) {
        breakEvenRec = calculateRecommendedMarketingSpend(
          results.breakEven.unitsRequired,
          results.baseSellingPrice,
          results.totalCostPerUnit,
          totalOperationalExpenses,
          channelFeePercent,
          targetROAS,
          costAllocationMethod,
          timePeriod
        );
      }
      
      // Calculate Target Profit Recommendation
      if (results.targetProfit && results.targetProfit.unitsRequired > 0 && results.targetProfit.unitsRequired !== Infinity) {
        targetProfitRec = calculateRecommendedMarketingSpend(
          results.targetProfit.unitsRequired,
          results.baseSellingPrice,
          results.totalCostPerUnit,
          totalOperationalExpenses,
          channelFeePercent,
          targetROAS,
          costAllocationMethod,
          timePeriod,
          results.targetProfit.targetProfitAmount || 0 // Include target profit amount
        );
      }
      
      // Determine which recommendation to use as default (show both, but use target profit if available)
      if (targetProfitRec) {
        const recommendedSpend = Math.round(targetProfitRec.recommendedMarketingSpend);
        setMarketingSpend(recommendedSpend);
        setMarketingSpendDisplay(formatInputNumber(recommendedSpend));
      } else if (breakEvenRec) {
        const recommendedSpend = Math.round(breakEvenRec.recommendedMarketingSpend);
        setMarketingSpend(recommendedSpend);
        setMarketingSpendDisplay(formatInputNumber(recommendedSpend));
      }
    }
    
    setBreakEvenRecommendation(breakEvenRec);
    setTargetProfitRecommendation(targetProfitRec);
    
    setCalculationResult(results);
    setPreliminaryResult(results); // Store for Final Summary
    
    if (onCalculate) {
      onCalculate(results, input);
    }
  };

  const handleMarketingChange = useCallback((spend: number, roas: number, costPerUnit: number) => {
    setMarketingSpend(spend);
    setTargetROAS(roas);
    setTargetROASDisplay(roas > 0 ? roas.toString() : '');
    setMarketingCostPerUnit(costPerUnit);
    
    // Notify parent about final selling price change when marketing data is available
    if (onStepChange && currentStep === 5 && preliminaryResult && marketingSpend > 0 && targetROAS > 0) {
      const finalSellingPrice = preliminaryResult.baseSellingPrice + costPerUnit;
      
      // Get channel fee percent from recommended channel
      const recommendedChannelId = preliminaryResult.summary.recommendedChannel
        ? preliminaryResult.channelPricing.find(c => c.channelName === preliminaryResult.summary.recommendedChannel)?.channelId
        : null;
      const recommendedChannel = salesChannels.find(c => c.id === recommendedChannelId);
      const channelFeePercent = recommendedChannel?.totalFeePercent || 0;
      
      onStepChange({
        currentStep,
        finalSellingPrice,
        marketingCostPerUnit: costPerUnit,
        channelFeePercent,
        baseTotalCostPerUnit: preliminaryResult.totalCostPerUnit,
      });
    }
    
    // Recalculate final pricing with marketing
    if (preliminaryResult) {
      // TODO: Recalculate with marketing cost included
      // This will be implemented in pricingCalculationEngine
    }
  }, [preliminaryResult, onStepChange, currentStep, salesChannels]);

  const handleReset = () => {
    setProductName('');
    setCategory('');
    setInitialCostBreakdown(undefined);
    setCostBreakdown(undefined);
    setProductionCostPerUnit(0);
    setOperationalExpenses([]);
    setTotalOperationalExpenses(0);
    setInitialExpenses(undefined);
    setInitialChannels(undefined);
    setSalesChannels([]);
    setSelectedChannels([]);
    setCalculationResult(null);
    setLoadKey(''); // Reset load key
    // Reset marketing state
    setMarketingSpend(0);
    setMarketingSpendDisplay('');
    setTargetROAS(2);
    setTargetROASDisplay('');
    setMarketingCostPerUnit(0);
    setPreliminaryResult(null);
    setBreakEvenRecommendation(null);
    setTargetProfitRecommendation(null);
    setHasCalculatedBreakEven(false);
    setHasCalculatedTargetProfit(false);
    setCurrentStep(1);
  };

  const loadCalculation = useCallback((calculation: SavedCalculation) => {
    const input = calculation.calculation_input;
    
    // Generate unique key untuk force re-render komponen child
    const uniqueKey = `load-${Date.now()}-${calculation.id}`;
    setLoadKey(uniqueKey);
    
    // Load basic product info
    setProductName(input.productName || '');
    setCategory(input.category || '');
    
    // Load production cost breakdown (if available)
    // Filter out admin-cost category (moved to Business Expenses)
    if (input.costBreakdown && input.costBreakdown.length > 0) {
      const filteredCostBreakdown = input.costBreakdown.filter(
        category => category.id !== 'admin-cost'
      );
      setInitialCostBreakdown(filteredCostBreakdown);
      setCostBreakdown(filteredCostBreakdown);
    } else {
      setInitialCostBreakdown(undefined);
      setCostBreakdown(undefined);
    }
    setProductionCostPerUnit(input.productionCostPerUnit || 0);
    
    // Load operational expenses
    if (input.operationalExpenses && input.operationalExpenses.length > 0) {
      setInitialExpenses(input.operationalExpenses);
      setOperationalExpenses(input.operationalExpenses);
    } else {
      setInitialExpenses([]);
      setOperationalExpenses([]);
    }
    setTotalOperationalExpenses(input.totalOperationalExpenses || 0);
    setTimePeriod(input.timePeriod || 'monthly');
    setCostAllocationMethod(input.costAllocationMethod || 'fixed-cost');
    
    // Load sales channels
    if (input.salesChannels && input.salesChannels.length > 0) {
      setInitialChannels(input.salesChannels);
      setSalesChannels(input.salesChannels);
    } else {
      setInitialChannels([]);
      setSalesChannels([]);
    }
    setSelectedChannels(input.selectedChannels || []);
    
    // Load pricing settings
    setCalculationMethod(input.calculationMethod || 'markup');
    if (input.markupPercent !== undefined) setMarkupPercent(input.markupPercent);
    if (input.marginPercent !== undefined) setMarginPercent(input.marginPercent);
    if (input.fixedProfit !== undefined) setFixedProfit(input.fixedProfit);
    setTargetProfitPercent(input.targetProfitPercent || 10);
    setMinimumMarginPercent(input.minimumMarginPercent || 15);
    
    // Load marketing data (if exists)
    if (input.targetROAS !== undefined) {
      setTargetROAS(input.targetROAS);
      setTargetROASDisplay(input.targetROAS > 0 ? input.targetROAS.toString() : '');
    }
    if (input.marketingSpend !== undefined) setMarketingSpend(input.marketingSpend);
    if (input.marketingCostPerUnit !== undefined) setMarketingCostPerUnit(input.marketingCostPerUnit);
    
    // Load calculation result
    setCalculationResult(calculation.calculation_result);
    setPreliminaryResult(calculation.calculation_result); // Store for Final Summary
    
    // Trigger onCalculate if needed
    if (onCalculate) {
      onCalculate(calculation.calculation_result, input);
    }
    
    // Navigate to step 1 to show all loaded data
    setCurrentStep(1);
  }, [onCalculate]);

  const loadTemplate = useCallback((templateData: PricingCalculationInput, templateName?: string) => {
    // Load basic product info
    setProductName(templateData.productName || '');
    setCategory(templateData.category || '');
    
    // Load cost breakdown detail (if available)
    let processedCostBreakdown = templateData.costBreakdown;
    
    // Special handling for "Parfum Import - Template Contoh"
    if (templateName === 'Parfum Import - Template Contoh' && processedCostBreakdown) {
      processedCostBreakdown = processedCostBreakdown.map(category => {
        if (category.isLaborCategory && category.items) {
          return {
            ...category,
            items: category.items.map(item => {
              // Ensure vendor method is used and clear other method fields
              const cleanedItem: any = {
                ...item,
                calculationMethod: 'vendor' as const,
                // Clear all salary method fields
                monthlySalary: undefined,
                workingDaysPerMonth: undefined,
                workingHoursPerDay: undefined,
                hoursPerUnit: undefined,
                // Clear manual method fields (but preserve vendor-related fields)
                amount: undefined,
                quantity: undefined,
                timePeriod: undefined,
                manualCostPerUnit: undefined,
                // Ensure vendor fields are set (preserve existing values or set defaults)
                vendorTimePeriod: item.vendorTimePeriod || 'hourly',
                vendorRate: item.vendorRate,
                unitsPerTimePeriod: item.unitsPerTimePeriod
              };
              return cleanedItem;
            })
          };
        }
        return category;
      });
    }
    
    if (processedCostBreakdown && processedCostBreakdown.length > 0) {
      // Filter out admin-cost category (moved to Business Expenses)
      const filteredCostBreakdown = processedCostBreakdown.filter(
        category => category.id !== 'admin-cost'
      );
      setInitialCostBreakdown(filteredCostBreakdown);
    }
    // Support backward compatibility: jika ada productionCostPerUnit, gunakan itu
    // Jika tidak, coba hitung dari totalProductionCost / productionUnits (legacy data)
    if (templateData.productionCostPerUnit) {
      setProductionCostPerUnit(templateData.productionCostPerUnit);
    } else if ((templateData as any).totalProductionCost && (templateData as any).productionUnits) {
      // Legacy data: hitung production cost per unit dari total / units
      const legacyCostPerUnit = (templateData as any).totalProductionCost / (templateData as any).productionUnits;
      setProductionCostPerUnit(legacyCostPerUnit);
    } else {
      setProductionCostPerUnit(0);
    }
    
    // Load operational expenses
    if (templateData.operationalExpenses && templateData.operationalExpenses.length > 0) {
      setInitialExpenses(templateData.operationalExpenses);
    }
    setOperationalExpenses(templateData.operationalExpenses || []);
    setTotalOperationalExpenses(templateData.totalOperationalExpenses || 0);
    setTimePeriod(templateData.timePeriod || 'monthly');
    setCostAllocationMethod(templateData.costAllocationMethod || 'fixed-cost');
    
    // Load sales channels
    if (templateData.salesChannels && templateData.salesChannels.length > 0) {
      setInitialChannels(templateData.salesChannels);
    }
    setSalesChannels(templateData.salesChannels || []);
    setSelectedChannels(templateData.selectedChannels || []);
    
    // Load pricing settings
    setCalculationMethod(templateData.calculationMethod || 'markup');
    if (templateData.markupPercent !== undefined) setMarkupPercent(templateData.markupPercent);
    if (templateData.marginPercent !== undefined) setMarginPercent(templateData.marginPercent);
    if (templateData.fixedProfit !== undefined) setFixedProfit(templateData.fixedProfit);
    setTargetProfitPercent(templateData.targetProfitPercent || 10);
    setMinimumMarginPercent(templateData.minimumMarginPercent || 15);
    
    // Clear calculation result (template is just starting point)
    setCalculationResult(null);
    
    // Stay on step 1 so user can review and edit
    setCurrentStep(1);
  }, []);

  useImperativeHandle(ref, () => ({
    loadCalculation,
    resetForm: handleReset,
  }), [loadCalculation]);

  const nextStep = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (step: number) => {
    setCurrentStep(step);
  };

  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 1:
        return productName.trim() !== '' && category.trim() !== '';
      case 2:
        return productionCostPerUnit > 0;
      case 3:
        return true; // Expenses optional
      case 4:
        return selectedChannels.length > 0;
      case 5:
        if (calculationMethod === 'markup') return markupPercent !== undefined && markupPercent > 0;
        if (calculationMethod === 'margin') return marginPercent !== undefined && marginPercent > 0 && marginPercent < 100;
        if (calculationMethod === 'fixed') return fixedProfit !== undefined && fixedProfit > 0;
        return false;
      case 6:
        return true; // Marketing is optional, can skip
      case 7:
        return true; // Final Summary can always be viewed
      default:
        return false;
    }
  };

  return (
    <div className="space-y-4">
      {/* Progress Indicator */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <button
                  onClick={() => goToStep(step.id)}
                  className="flex flex-col items-center flex-1 cursor-pointer hover:opacity-80 transition-opacity"
                  type="button"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                      currentStep === step.id
                        ? "bg-primary text-primary-foreground"
                        : currentStep > step.id
                          ? "bg-brand-blue text-brand-white"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {currentStep > step.id ? <Check className="h-5 w-5" /> : step.id}
                  </div>
                  <span
                    className={`mt-2 text-xs font-medium ${
                      currentStep >= step.id ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                </button>
                {index < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 ${
                      currentStep > step.id ? "bg-brand-blue" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      <div className="space-y-4">
        {/* Step 1: Product Information */}
        {currentStep === 1 && (
          <Card className="border-primary/15 shadow-sm ring-1 ring-primary/5">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 border-b border-border pb-4">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Package className="h-5 w-5 shrink-0 text-brand-blue" aria-hidden />
                {t("pricingTools.wizard.step1.title", "Product Information")}
              </CardTitle>
              <LoadTemplateModal onLoadTemplate={loadTemplate} />
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div>
                <Label htmlFor="product-name" className="text-sm font-medium">
                  {t("pricingTools.wizard.step1.productNameLabel", "Product Name *")}
                </Label>
                <Input
                  id="product-name"
                  placeholder={t(
                    "pricingTools.wizard.step1.productNamePlaceholder",
                    "Enter product name",
                  )}
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="product-category" className="text-sm font-medium">
                  {t("pricingTools.wizard.step1.categoryLabel", "Category *")}
                </Label>
                <Input
                  id="product-category"
                  placeholder={t(
                    "pricingTools.wizard.step1.categoryPlaceholder",
                    "Enter product category",
                  )}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Production Costs */}
        {currentStep === 2 && (
          <div>
            <DynamicCostBreakdown 
              onTotalChange={handleProductionCostChange}
              onCostBreakdownChange={handleCostBreakdownChange}
              initialCostCategories={initialCostBreakdown}
              key={`cost-breakdown-${loadKey}-${JSON.stringify(initialCostBreakdown)}`}
            />
          </div>
        )}

        {/* Step 3: Business Expenses */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Time Period</Label>
                      <Select
                        value={timePeriod}
                        onValueChange={(value: TimePeriod) => setTimePeriod(value)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Cost Allocation Method</Label>
                      <Select
                        value={costAllocationMethod}
                        onValueChange={(value: CostAllocationMethod) => setCostAllocationMethod(value)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="per-unit">Per Unit (Distribute to units)</SelectItem>
                          <SelectItem value="fixed-cost">Fixed Cost (Cover from total sales)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <BusinessExpensesForm
              onExpensesChange={handleExpensesChange}
              timePeriod={timePeriod}
              costAllocationMethod={costAllocationMethod}
              initialExpenses={initialExpenses}
              key={`expenses-${loadKey}-${JSON.stringify(initialExpenses)}`}
            />
          </div>
        )}

        {/* Step 4: Sales Channels */}
        {currentStep === 4 && (
          <SalesChannelManager 
            onChannelsChange={handleChannelsChange}
            initialChannels={initialChannels}
            key={`channels-${loadKey}-${JSON.stringify(initialChannels)}`}
          />
        )}

        {/* Step 5: Pricing Settings */}
        {currentStep === 5 && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-6">
                <Calculator className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Pengaturan Harga Jual</h3>
              </div>
              <div className="space-y-4">
                {/* Grid 3 kolom: Tentukan Harga Jual (kiri) | Tombol Hitung (tengah) | Break-Even Analysis (kanan) */}
                <div className="grid grid-cols-[2fr_auto_2fr] gap-4">
                  {/* Kolom 1: Tentukan Harga Jual per Unit - Left Column */}
                  <div className="bg-brand-blue-soft p-4 rounded-lg border border-brand-blue/25">
                    <div className="flex items-center gap-2 mb-3">
                      <h4 className="text-sm font-semibold text-brand-blue-deep">
                        Tentukan Harga Jual per Unit
                      </h4>
                      <Badge variant="outline" className="text-xs bg-brand-blue-soft text-brand-blue-deep border-brand-blue/35">
                        WAJIB
                      </Badge>
                    </div>
                    
                    <RadioGroup
                      value={calculationMethod}
                      onValueChange={(value: CalculationMethod) => setCalculationMethod(value)}
                      className="space-y-2 mb-4"
                    >
                      <div className="flex items-start space-x-3 p-2 border rounded-lg bg-white">
                        <RadioGroupItem value="markup" id="markup" className="mt-1" />
                        <Label htmlFor="markup" className="text-sm cursor-pointer">
                          Markup (% dari total biaya)
                        </Label>
                      </div>
                      <div className="flex items-start space-x-3 p-2 border rounded-lg bg-white">
                        <RadioGroupItem value="margin" id="margin" className="mt-1" />
                        <Label htmlFor="margin" className="text-sm cursor-pointer">
                          Margin (% dari Production Cost)
                        </Label>
                      </div>
                      <div className="flex items-start space-x-3 p-2 border rounded-lg bg-white">
                        <RadioGroupItem value="fixed" id="fixed" className="mt-1" />
                        <Label htmlFor="fixed" className="text-sm cursor-pointer">
                          Profit Tetap (Rp per unit)
                        </Label>
                      </div>
                    </RadioGroup>

                    <div>
                      <Label className="text-sm font-medium">
                        {calculationMethod === 'markup' ? 'Markup (%)' : calculationMethod === 'margin' ? 'Margin (%)' : 'Profit Tetap (Rp)'}
                      </Label>
                      <Input
                        type="number"
                        placeholder={calculationMethod === 'fixed' ? "5000" : "50"}
                        value={
                          calculationMethod === 'markup'
                            ? markupPercent
                            : calculationMethod === 'margin'
                            ? marginPercent
                            : fixedProfit
                        }
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0;
                          if (calculationMethod === 'markup') setMarkupPercent(value);
                          else if (calculationMethod === 'margin') setMarginPercent(value);
                          else setFixedProfit(value);
                        }}
                        className="mt-2"
                        min="0"
                        step={calculationMethod === 'fixed' ? '1000' : '0.1'}
                        max={calculationMethod === 'margin' ? '99' : undefined}
                      />
                    </div>
                    
                    {/* Field "From Production Cost" - Hanya muncul jika memilih Margin */}
                    {calculationMethod === 'margin' && (
                      <div className="mt-3">
                        <div className="bg-brand-blue-soft p-4 rounded-lg border border-brand-blue/25">
                          <div className="text-center">
                            <p className="text-sm text-brand-blue-on-soft font-medium">
                              From Production Cost
                            </p>
                            <p className="text-2xl font-bold text-brand-blue-deep">
                              {formatRupiah(productionCostPerUnit)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Kolom 2: Tombol Hitung - Middle Column */}
                  <div className="flex items-center justify-center">
                    <Button onClick={handleCalculateBreakEven} size="sm" className="flex items-center justify-center gap-2 whitespace-nowrap w-[200px]">
                      {t('pricingTools.wizard.step5.buttons.calculatePrice', 'Hitung Harga Jual')}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Kolom 3: Break-Even Analysis - Right Column */}
                  <div className="bg-brand-blue-soft p-4 rounded-lg border border-brand-blue/25">
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="h-4 w-4 text-brand-blue-on-soft" />
                      <h4 className="text-sm font-semibold text-brand-blue-deep">
                        Break-Even Analysis
                      </h4>
                    </div>
                    {calculationResult ? (
                      <div className="space-y-2">
                        <div className="bg-white p-2.5 rounded border border-brand-blue/25 flex justify-between items-center">
                          <span className="text-xs text-brand-blue-deep">Recommended Selling Price:</span>
                          <div className="text-right">
                            <span className="text-sm font-semibold text-brand-blue-deep">
                              {formatRupiah(calculationResult.summary.recommendedSellingPrice)}
                            </span>
                            {calculationResult.summary.recommendedChannel && (
                              <p className="text-xs text-brand-blue-on-soft mt-0.5">
                                Best on: {calculationResult.summary.recommendedChannel}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="bg-white p-2.5 rounded border border-brand-blue/25 flex justify-between items-center">
                          <span className="text-xs text-brand-blue-deep">Profit per Unit:</span>
                          <div className="text-right">
                            <span className="text-sm font-semibold text-brand-blue-deep">
                              {formatRupiah(calculationResult.profitPerUnit)}
                            </span>
                            <p className="text-xs text-brand-blue-on-soft mt-0.5">
                              per unit
                            </p>
                          </div>
                        </div>
                        <div className="bg-white p-2.5 rounded border border-brand-blue/25 flex justify-between items-center">
                          <span className="text-xs text-brand-blue-deep">Profit Margin:</span>
                          <div className="text-right">
                            <span className="text-sm font-semibold text-brand-blue-deep">
                              {calculationResult.profitMarginPercent.toFixed(2)}%
                            </span>
                            <p className="text-xs text-brand-blue-on-soft mt-0.5">
                              dari harga jual
                            </p>
                          </div>
                        </div>
                        <div className="bg-white p-2.5 rounded border border-brand-blue/25 flex justify-between items-center">
                          <span className="text-xs text-brand-blue-deep">Units Required:</span>
                          <div className="text-right">
                            <span className="text-sm font-semibold text-brand-blue-deep">
                              {calculationResult.breakEven.unitsRequired === Infinity 
                                ? '∞' 
                                : formatNumber(calculationResult.breakEven.unitsRequired)}
                            </span>
                            <p className="text-xs text-brand-blue-on-soft mt-0.5">
                              {timePeriod === 'monthly' ? 'unit/bulan' : 'unit/tahun'}
                            </p>
                          </div>
                        </div>
                        <div className="bg-white p-2.5 rounded border border-brand-blue/25 flex justify-between items-center">
                          <span className="text-xs text-brand-blue-deep">Revenue Required:</span>
                          <div className="text-right">
                            <span className="text-sm font-semibold text-brand-blue-deep">
                              {calculationResult.breakEven.revenueRequired === Infinity 
                                ? '∞' 
                                : formatRupiah(calculationResult.breakEven.revenueRequired)}
                            </span>
                            <p className="text-xs text-brand-blue-on-soft mt-0.5">
                              {timePeriod === 'monthly' ? 'target/bulan' : 'target/tahun'}
                            </p>
                          </div>
                        </div>
                        {breakEvenRecommendation && targetROAS > 0 && (
                          <div className="bg-white p-2.5 rounded border border-brand-blue/25 flex justify-between items-center">
                            <span className="text-xs text-brand-blue-deep">Recommended Marketing Spend:</span>
                            <div className="text-right">
                              <span className="text-sm font-semibold text-brand-blue-deep">
                                {formatRupiah(breakEvenRecommendation.recommendedMarketingSpend)}
                              </span>
                              <p className="text-xs text-brand-blue-on-soft mt-0.5">
                                ROAS {targetROAS}:1
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground/70 text-sm">
                        <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Klik tombol "Hitung Harga Jual" untuk melihat hasil</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Grid 3 kolom: Analisis Target Penjualan (kiri) | Tombol Hitung Target Penjualan (tengah) | Target Profit Analysis (kanan) */}
                <div className="grid grid-cols-[2fr_auto_2fr] gap-4">
                  {/* Kolom Kiri: Analisis Target Penjualan */}
                  <div className="bg-primary/10 p-4 rounded-lg border border-primary/25">
                    <div className="flex items-center gap-2 mb-3">
                      <h4 className="text-sm font-semibold text-primary">
                        Analisis Target Penjualan
                      </h4>
                      <Badge variant="outline" className="text-xs bg-primary/15 text-primary border-primary/30">
                        OPSIONAL
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Target Profit (%) dari Total Biaya</Label>
                      <Input
                        type="number"
                        placeholder="10"
                        value={targetProfitPercent || ''}
                        onChange={(e) => setTargetProfitPercent(parseFloat(e.target.value) || 0)}
                        className="mt-2"
                        min="0"
                        step="0.1"
                      />
                      {preliminaryResult && preliminaryResult.totalCostPerUnit > 0 && hasCalculatedTargetProfit && (() => {
                        // Get recommended channel fee percent
                        const recommendedChannelId = preliminaryResult.summary.recommendedChannel 
                          ? preliminaryResult.channelPricing.find(c => c.channelName === preliminaryResult.summary.recommendedChannel)?.channelId
                          : null;
                        const recommendedChannel = salesChannels.find(c => c.id === recommendedChannelId);
                        const channelFeePercent = recommendedChannel?.totalFeePercent || 0;
                        
                        // Calculate net profit per unit after channel fee
                        const sellingPrice = preliminaryResult.baseSellingPrice;
                        const channelFeePerUnit = (sellingPrice * channelFeePercent) / 100;
                        const netProfitPerUnitAfterFee = sellingPrice - productionCostPerUnit - channelFeePerUnit;
                        
                        // Calculate units needed to cover business expenses
                        const unitsForBusinessExpenses = totalOperationalExpenses > 0 && netProfitPerUnitAfterFee > 0
                          ? Math.ceil(totalOperationalExpenses / netProfitPerUnitAfterFee)
                          : 0;
                        const businessExpensesPerUnit = unitsForBusinessExpenses > 0
                          ? totalOperationalExpenses / unitsForBusinessExpenses
                          : 0;
                        
                        // Calculate units for target profit
                        const targetProfitAmount = targetProfitPercent > 0 && preliminaryResult.targetProfit
                          ? preliminaryResult.targetProfit.targetProfitAmount
                          : 0;
                        const unitsForTargetProfit = targetProfitAmount > 0 && netProfitPerUnitAfterFee > 0
                          ? Math.ceil(targetProfitAmount / netProfitPerUnitAfterFee)
                          : 0;
                        
                        return (
                          <div className="mt-3 space-y-2">
                            {/* Total Biaya - Style seperti "From Production Cost" */}
                            {preliminaryResult.targetProfit && preliminaryResult.targetProfit.totalCost > 0 && (
                              <div>
                                <div className="bg-brand-blue-soft p-4 rounded-lg border border-brand-blue/25">
                                  <div className="text-center">
                                    <p className="text-sm text-brand-blue-on-soft font-medium">
                                      From Total Cost
                                    </p>
                                    <p className="text-2xl font-bold text-brand-blue-deep">
                                      {formatRupiah(preliminaryResult.targetProfit.totalCost)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {/* Total Biaya untuk Target Profit */}
                            {preliminaryResult.targetProfit && preliminaryResult.targetProfit.totalCost > 0 && (
                              <div className="bg-white p-3 rounded-lg border border-primary/25">
                                <div className="text-xs text-muted-foreground mb-2">Total Biaya (untuk {formatNumber(preliminaryResult.targetProfit.unitsRequired)} unit)</div>
                                <div className="space-y-1.5">
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-muted-foreground">Production Cost</span>
                                    <span className="text-xs font-medium text-foreground">
                                      {formatRupiah(preliminaryResult.targetProfit.productionCost)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-muted-foreground">Operational Cost</span>
                                    <span className="text-xs font-medium text-foreground">
                                      {formatRupiah(preliminaryResult.targetProfit.operationalCost)}
                                    </span>
                                  </div>
                                  {preliminaryResult.targetProfit.channelFee > 0 && (
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs text-muted-foreground">Channel Fee</span>
                                      <span className="text-xs font-medium text-foreground">
                                        {formatRupiah(preliminaryResult.targetProfit.channelFee)}
                                      </span>
                                    </div>
                                  )}
                                  <div className="pt-1.5 border-t border-border">
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs font-medium text-primary">Total Cost</span>
                                      <span className="text-sm font-semibold text-primary">
                                        {formatRupiah(preliminaryResult.targetProfit.totalCost)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Kolom Tengah: Tombol Hitung Target Penjualan */}
                  <div className="flex items-center justify-center">
                    <Button onClick={handleCalculateTargetProfit} size="sm" className="flex items-center justify-center gap-2 whitespace-nowrap w-[200px]">
                      {t('pricingTools.wizard.step5.buttons.calculateTarget', 'Hitung Target Penjualan')}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Kolom Kanan: Target Profit Analysis */}
                  <div className="bg-primary/10 p-4 rounded-lg border border-primary/25">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <h4 className="text-sm font-semibold text-primary">
                        Target Profit Analysis
                      </h4>
                    </div>
                    {calculationResult && calculationResult.targetProfit ? (
                      <div className="space-y-2">
                        <div className="bg-white p-2.5 rounded border border-primary/25 flex justify-between items-center">
                          <span className="text-xs text-primary">Units Required:</span>
                          <div className="text-right">
                            <span className="text-sm font-semibold text-primary">
                              {calculationResult.targetProfit.unitsRequired === Infinity 
                                ? '∞' 
                                : formatNumber(calculationResult.targetProfit.unitsRequired)}
                            </span>
                            <p className="text-xs text-primary mt-0.5">
                              {timePeriod === 'monthly' ? 'unit/bulan' : 'unit/tahun'}
                            </p>
                          </div>
                        </div>
                        {/* Total Biaya Breakdown */}
                        <div className="bg-white p-3 rounded-lg border border-primary/25">
                          <div className="text-xs text-muted-foreground mb-2">Total Biaya (untuk {formatNumber(calculationResult.targetProfit.unitsRequired)} unit)</div>
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">Production Cost</span>
                              <span className="text-xs font-medium text-foreground">
                                {formatRupiah(calculationResult.targetProfit.productionCost)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">Operational Cost</span>
                              <span className="text-xs font-medium text-foreground">
                                {formatRupiah(calculationResult.targetProfit.operationalCost)}
                              </span>
                            </div>
                            {calculationResult.targetProfit.channelFee > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">Channel Fee</span>
                                <span className="text-xs font-medium text-foreground">
                                  {formatRupiah(calculationResult.targetProfit.channelFee)}
                                </span>
                              </div>
                            )}
                            <div className="pt-1.5 border-t border-border">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-medium text-primary">Total Biaya</span>
                                <span className="text-sm font-semibold text-primary">
                                  {formatRupiah(calculationResult.targetProfit.totalCost)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        {/* Revenue Required Breakdown */}
                        <div className="bg-white p-3 rounded-lg border border-primary/25">
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">Total Biaya</span>
                              <span className="text-xs font-medium text-foreground">
                                {formatRupiah(calculationResult.targetProfit.totalCost)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted-foreground">Target Profit ({targetProfitPercent}% dari Total Biaya)</span>
                              <span className="text-xs font-medium text-primary">
                                {formatRupiah(calculationResult.targetProfit.targetProfitAmount)}
                              </span>
                            </div>
                            <div className="pt-1.5 border-t border-border">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-medium text-primary">Revenue Required</span>
                                <span className="text-sm font-semibold text-primary">
                                  {formatRupiah(calculationResult.targetProfit.revenueRequired)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        {targetProfitRecommendation && targetROAS > 0 && (
                          <div className="bg-white p-2.5 rounded border border-primary/25 flex justify-between items-center">
                            <span className="text-xs text-primary">Recommended Marketing Spend:</span>
                            <div className="text-right">
                              <span className="text-sm font-semibold text-primary">
                                {formatRupiah(targetProfitRecommendation.recommendedMarketingSpend)}
                              </span>
                              <p className="text-xs text-primary mt-0.5">
                                ROAS {targetROAS}:1
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground/70 text-sm">
                        <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Klik tombol "Hitung Target Penjualan" untuk melihat hasil</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Grid 3 kolom: Marketing Spend (kiri) | Tombol Final Summary (tengah) | Marketing Results (kanan) */}
                <div className="grid grid-cols-[2fr_auto_2fr] gap-4">
                  {/* Kolom Kiri: Marketing Spend (per bulan) */}
                  <div className="bg-primary/10 p-4 rounded-lg border border-primary/25">
                    <div className="flex items-center gap-2 mb-3">
                      <h4 className="text-sm font-semibold text-primary">
                        {t('pricingTools.wizard.step5.marketingSpend.title', 'Marketing Spend (per bulan)')}
                      </h4>
                      <Badge variant="outline" className="text-xs bg-primary/15 text-primary border-primary/30">
                        {t('pricingTools.wizard.step5.marketingSpend.optional', 'OPSIONAL')}
                      </Badge>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium">Marketing Spend ({timePeriod === 'monthly' ? 'per bulan' : 'per tahun'})</Label>
                        <Input
                          type="text"
                          placeholder="5.000.000"
                          value={marketingSpendDisplay}
                          onChange={(e) => {
                            const rawValue = e.target.value;
                            // Parse untuk mendapatkan nilai numerik
                            const parsedValue = parseInputNumber(rawValue);
                            // Format dengan formatInputNumber yang sudah handle string dengan benar
                            const formattedValue = formatInputNumber(parsedValue);
                            setMarketingSpendDisplay(formattedValue);
                            setMarketingSpend(parsedValue);
                          }}
                          onBlur={(e) => {
                            const parsedValue = parseInputNumber(e.target.value);
                            const roundedValue = Math.round(parsedValue);
                            setMarketingSpend(roundedValue);
                            setMarketingSpendDisplay(formatInputNumber(roundedValue));
                          }}
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Target ROAS (untuk Marketing)</Label>
                        <Input
                          type="text"
                          placeholder="0"
                          value={targetROASDisplay}
                          onChange={(e) => {
                            const value = e.target.value;
                            // Allow empty string, numbers, and single decimal point
                            if (value === '' || /^\d*\.?\d*$/.test(value)) {
                              setTargetROASDisplay(value);
                              
                              if (value === '' || value === '.') {
                                setTargetROAS(0);
                              } else {
                                const numValue = parseFloat(value);
                                if (!isNaN(numValue) && numValue >= 0) {
                                  setTargetROAS(numValue);
                                }
                              }
                            }
                          }}
                          onBlur={(e) => {
                            const value = e.target.value.trim();
                            if (value === '' || value === '.') {
                              setTargetROAS(0);
                              setTargetROASDisplay('');
                            } else {
                              const numValue = parseFloat(value);
                              if (!isNaN(numValue) && numValue >= 0) {
                                setTargetROAS(numValue);
                                setTargetROASDisplay(numValue.toString());
                              } else {
                                // Reset to current targetROAS value or empty
                                setTargetROASDisplay(targetROAS > 0 ? targetROAS.toString() : '');
                              }
                            }
                          }}
                          onKeyDown={(e) => {
                            // Allow backspace and delete to clear the field
                            if (e.key === 'Backspace' || e.key === 'Delete') {
                              // Let the default behavior happen
                              return;
                            }
                            // Allow numbers, decimal point, and control keys
                            if (!/[0-9.]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(e.key) && !e.ctrlKey && !e.metaKey) {
                              e.preventDefault();
                            }
                          }}
                          className="mt-2"
                        />
                        <p className="text-xs text-muted-foreground mt-1">ROAS 3:1 = setiap Rp 1 spend menghasilkan Rp 3 revenue</p>
                      </div>
                    </div>
                  </div>

                  {/* Kolom Tengah: Tombol Final Summary */}
                  <div className="flex items-center justify-center">
                    <Button 
                      onClick={() => {
                        // Recalculate to ensure latest data before showing summary
                        if (preliminaryResult) {
                          handleCalculate();
                        }
                        setCurrentStep(6);
                      }} 
                      size="sm" 
                      className="flex items-center justify-center gap-2 whitespace-nowrap w-[200px]"
                    >
                      Final Summary
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Kolom Kanan: Marketing Results - Tampilkan setelah klik Final Summary */}
                  <div className="bg-primary/10 p-4 rounded-lg border border-primary/25">
                    <div className="flex items-center gap-2 mb-3">
                      <h4 className="text-sm font-semibold text-primary">
                        Marketing Results
                      </h4>
                    </div>
                    {calculationResult && hasCalculatedTargetProfit && marketingSpend > 0 && targetROAS > 0 && calculatedFinalSellingPrice > 0 && calculatedMarketingCostPerUnit > 0 ? (
                      (() => {
                        // Calculate expected revenue
                        const expectedRevenue = marketingSpend * targetROAS;
                        
                        // Calculate estimated units sold based on final selling price
                        const estimatedUnitsSold = calculatedFinalSellingPrice > 0 
                          ? expectedRevenue / calculatedFinalSellingPrice 
                          : 0;
                        
                        return (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white p-3 rounded border border-primary/25">
                              <div className="text-xs text-muted-foreground mb-1">Marketing Cost per Unit</div>
                              <div className="text-sm font-semibold text-primary">
                                {formatRupiah(calculatedMarketingCostPerUnit)}
                              </div>
                            </div>
                            <div className="bg-white p-3 rounded border border-brand-blue/25">
                              <div className="text-xs text-muted-foreground mb-1">Final Selling Price</div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1">
                                  <div className="text-xs text-muted-foreground">From</div>
                                  <div className="text-xs font-semibold text-brand-blue-deep">
                                    {formatRupiah(calculationResult.baseSellingPrice)}
                                  </div>
                                </div>
                                <div className="text-muted-foreground/40">→</div>
                                <div className="flex-1">
                                  <div className="text-xs text-muted-foreground">To</div>
                                  <div className="text-sm font-semibold text-brand-blue-deep">
                                    {formatRupiah(calculatedFinalSellingPrice)} <span className="text-xs text-muted-foreground">unit</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="bg-white p-3 rounded border border-brand-blue/25">
                              <div className="text-xs text-muted-foreground mb-1">Units to Sell</div>
                              <div className="text-sm font-semibold text-brand-blue-deep">
                                {formatNumber(Math.round(estimatedUnitsSold))} <span className="text-xs text-muted-foreground">unit</span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">(for ROAS target)</div>
                            </div>
                            <div className="bg-white p-3 rounded border border-brand-blue/25">
                              <div className="text-xs text-muted-foreground mb-1">Expected Revenue</div>
                              <div className="text-sm font-semibold text-brand-blue-deep">
                                {formatRupiah(expectedRevenue)}
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="text-center py-8 text-muted-foreground/70 text-sm">
                        <p>{hasCalculatedTargetProfit 
                          ? t('pricingTools.wizard.step5.marketingResults.placeholder', 'Isi Marketing Spend dan Target ROAS, lalu klik "Final Summary" untuk melihat hasil')
                          : 'Klik tombol "Hitung Target Penjualan" untuk melihat hasil'
                        }</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bagian 3: Minimum Margin */}
                <div className="rounded-lg border border-brand-red/25 bg-brand-red/5 p-4">
                  <h4 className="mb-3 text-sm font-semibold text-brand-red">
                    Minimum Margin (Opsional)
                  </h4>
                  <div>
                    <Label className="text-sm font-medium">Minimum Margin (%)</Label>
                    <Input
                      type="number"
                      placeholder="15"
                      value={minimumMarginPercent || ''}
                      onChange={(e) => setMinimumMarginPercent(parseFloat(e.target.value) || 0)}
                      className="mt-2"
                      min="0"
                      step="0.1"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button onClick={handleReset} variant="outline" size="lg">
                    Reset
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 6: Final Summary */}
        {currentStep === 6 && (
          <div className="space-y-4">
            {preliminaryResult && preliminaryResult.baseSellingPrice > 0 ? (
              <FinalSummary
                preliminaryResult={preliminaryResult}
                marketingSpend={marketingSpend}
                targetROAS={targetROAS}
                marketingCostPerUnit={calculatedMarketingCostPerUnit > 0 ? calculatedMarketingCostPerUnit : marketingCostPerUnit}
                finalSellingPrice={calculatedFinalSellingPrice > 0 ? calculatedFinalSellingPrice : (preliminaryResult.baseSellingPrice + marketingCostPerUnit)}
                operationalExpenses={totalOperationalExpenses}
                costAllocationMethod={costAllocationMethod}
                channelFeePercent={(() => {
                  const recommendedChannelId = preliminaryResult.summary.recommendedChannel
                    ? preliminaryResult.channelPricing.find(c => c.channelName === preliminaryResult.summary.recommendedChannel)?.channelId
                    : null;
                  const recommendedChannel = salesChannels.find(c => c.id === recommendedChannelId);
                  return recommendedChannel?.totalFeePercent || 0;
                })()}
                baseTotalCostPerUnit={preliminaryResult.totalCostPerUnit}
                timePeriod={timePeriod}
                calculationMethod={calculationMethod}
                markupPercent={markupPercent}
                marginPercent={marginPercent}
                fixedProfit={fixedProfit}
                targetProfitPercent={targetProfitPercent}
                minimumMarginPercent={minimumMarginPercent}
                productName={productName}
                category={category}
              />
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-brand-red" />
                    <p className="text-muted-foreground">
                      Silakan selesaikan Step 5 (Pricing Settings) terlebih dahulu.
                    </p>
                    <Button 
                      onClick={() => goToStep(5)} 
                      className="mt-4"
                    >
                      Kembali ke Pricing Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Calculation Results - Hide on Pricing Settings (step 5) and Final Summary step (step 6) */}
      {calculationResult && currentStep !== 5 && currentStep !== 6 && (
        <TargetCalculationResults 
          results={calculationResult} 
          timePeriod={timePeriod}
          breakEvenRecommendation={breakEvenRecommendation}
          targetProfitRecommendation={targetProfitRecommendation}
          targetROAS={targetROAS}
          isPreliminary={calculationResult.isPreliminary || false}
          currentStep={currentStep}
          targetProfitPercent={targetProfitPercent}
        />
      )}

      {/* Navigation Buttons */}
      {/* Show navigation buttons if no result yet, or if we're on Step 5/6/7 (after calculation) */}
      {(!calculationResult || currentStep >= 5) && (
        <div className="flex justify-between items-center pt-4">
          <Button
            onClick={prevStep}
            variant="outline"
            disabled={currentStep === 1}
          >
            Previous
          </Button>
          {currentStep < STEPS.length && (
            <Button
              onClick={nextStep}
              disabled={currentStep >= STEPS.length || !isStepValid(currentStep)}
            >
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
});

PricingWizard.displayName = 'PricingWizard';

