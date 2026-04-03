export type TimePeriod = "monthly" | "yearly";
export type CostAllocationMethod = "per-unit" | "fixed-cost";
export type CalculationMethod = "markup" | "margin" | "fixed";

export interface BusinessExpenseItem {
  id: string;
  category: string;
  name: string;
  amount: number;
  month?: number;
}

export interface BusinessExpenseCategory {
  id: string;
  name: string;
  isCustom: boolean;
  color: string;
}

export interface SalesChannel {
  id: string;
  name: string;
  type: "online" | "offline";
  commissionPercent: number;
  paymentFeePercent?: number;
  adSpendPercent?: number;
  otherFeePercent?: number;
  totalFeePercent: number;
  isActive: boolean;
  isDefault?: boolean;
}

export interface CostBreakdownItem {
  id: string;
  name: string;
  amount: number;
  timePeriod?: "hourly" | "daily" | "monthly";
  quantity?: number;
  isForTotalBatch?: boolean;
  monthlySalary?: number;
  workingDaysPerMonth?: number;
  workingHoursPerDay?: number;
  hoursPerUnit?: number;
  vendorRate?: number;
  vendorTimePeriod?: "hourly" | "daily" | "monthly";
  unitsPerTimePeriod?: number;
  manualCostPerUnit?: number;
  flatRate?: number;
  flatRateUnits?: number;
  marketingSpend?: number;
  targetROAS?: number;
  estimatedUnitsSold?: number;
  estimatedSellingPrice?: number;
  expectedRevenue?: number;
  marketingCalculationMethod?: "roas" | "flat-rate" | "manual";
}

export interface CostCategory {
  id: string;
  title: string;
  items: CostBreakdownItem[];
  color: string;
  isLaborCategory?: boolean;
}

export interface PricingCalculationInput {
  productName: string;
  category: string;
  costBreakdown?: CostCategory[];
  productionCostPerUnit: number;
  operationalExpenses: BusinessExpenseItem[];
  totalOperationalExpenses: number;
  costAllocationMethod: CostAllocationMethod;
  timePeriod: TimePeriod;
  calculationMethod: CalculationMethod;
  markupPercent?: number;
  marginPercent?: number;
  fixedProfit?: number;
  salesChannels: SalesChannel[];
  selectedChannels: string[];
  targetProfitPercent?: number;
  minimumMarginPercent: number;
  marketingSpend?: number;
  targetROAS?: number;
  marketingCostPerUnit?: number;
  baseSellingPrice?: number;
}

export interface ChannelPricingResult {
  channelId: string;
  channelName: string;
  sellingPrice: number;
  fees: number;
  netProfit: number;
  profitMargin: number;
  costPerUnit: number;
}

export interface BreakEvenAnalysis {
  unitsRequired: number;
  revenueRequired: number;
  monthsToBreakEven?: number;
  totalExpenses?: number;
  productionCost?: number;
  operationalCost?: number;
  channelFee?: number;
  marketingCost?: number;
  netProfitPerUnit?: number;
}

export interface TargetProfitAnalysis {
  totalCost: number;
  productionCost: number;
  operationalCost: number;
  channelFee: number;
  marketingCost?: number;
  targetProfitAmount: number;
  unitsRequired: number;
  revenueRequired: number;
  monthsToTarget?: number;
}

export interface PricingCalculationWarnings {
  lowMargin: boolean;
  lowMarginMessage?: string;
  unrealisticTarget?: string;
  invalidInputs?: string[];
}

export interface PricingCalculationResult {
  baseSellingPrice: number;
  totalCostPerUnit: number;
  profitPerUnit: number;
  profitMarginPercent: number;
  markupPercent: number;
  channelPricing: ChannelPricingResult[];
  breakEven: BreakEvenAnalysis;
  targetProfit: TargetProfitAnalysis | null;
  warnings: PricingCalculationWarnings;
  summary: {
    totalExpenses: number;
    recommendedSellingPrice: number;
    recommendedChannel?: string;
    productionCostPerUnit: number;
    operationalCostPerUnit: number;
    breakEvenChannelFee?: number;
    netProfitPerUnit?: number;
    channelFeePercentage?: number;
  };
  isPreliminary?: boolean;
  preliminaryResults?: {
    baseSellingPrice: number;
    totalCostPerUnit: number;
    breakEven: BreakEvenAnalysis;
    targetProfit: TargetProfitAnalysis | null;
  };
  marketing?: {
    marketingSpend: number;
    targetROAS: number;
    expectedRevenue: number;
    estimatedUnitsSold: number;
    marketingCostPerUnit: number;
    baseSellingPrice: number;
    finalSellingPrice: number;
    finalTotalCostPerUnit: number;
    finalBreakEven: BreakEvenAnalysis;
    finalTargetProfit: TargetProfitAnalysis | null;
  };
}
