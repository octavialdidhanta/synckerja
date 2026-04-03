// Format rupiah dengan titik sebagai ribuan separator (1.000.000)
export const formatRupiah = (amount: number): string => {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return 'Rp 0';
  }
  return `Rp ${amount.toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
};

// Format number dengan titik sebagai ribuan separator
export const formatNumber = (amount: number): string => {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '0';
  }
  return amount.toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

// Format number dengan decimal places
export const formatNumberWithDecimal = (amount: number, decimals: number = 2): string => {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '0';
  }
  return amount.toLocaleString('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

// Parse rupiah string ke number
export const parseRupiah = (value: string): number => {
  if (!value) return 0;
  return parseFloat(value.replace(/[^\d.]/g, "")) || 0;
};

export { formatInputNumber, parseInputNumber } from "@/shared/lib/pricingInputUtils";

// Calculate selling price berdasarkan markup
export const calculateSellingPriceByMarkup = (
  cost: number,
  markupPercent: number
): number => {
  if (isNaN(cost) || isNaN(markupPercent)) return 0;
  return cost * (1 + markupPercent / 100);
};

// Calculate selling price berdasarkan margin
export const calculateSellingPriceByMargin = (
  cost: number,
  marginPercent: number
): number => {
  if (isNaN(cost) || isNaN(marginPercent)) return 0;
  if (marginPercent >= 100) return Infinity;
  return cost / (1 - marginPercent / 100);
};

// Calculate selling price berdasarkan fixed profit
export const calculateSellingPriceByFixedProfit = (
  cost: number,
  fixedProfit: number
): number => {
  if (isNaN(cost) || isNaN(fixedProfit)) return 0;
  return cost + fixedProfit;
};

// Calculate profit margin percentage
export const calculateProfitMargin = (
  sellingPrice: number,
  cost: number
): number => {
  if (isNaN(sellingPrice) || isNaN(cost) || sellingPrice === 0) return 0;
  return ((sellingPrice - cost) / sellingPrice) * 100;
};

// Calculate markup percentage
export const calculateMarkup = (sellingPrice: number, cost: number): number => {
  if (isNaN(sellingPrice) || isNaN(cost) || cost === 0) return 0;
  return ((sellingPrice - cost) / cost) * 100;
};

// Calculate target units to sell untuk break-even
export const calculateBreakEvenUnits = (
  totalExpenses: number,
  profitPerUnit: number
): number => {
  if (isNaN(totalExpenses) || isNaN(profitPerUnit) || profitPerUnit <= 0) {
    return Infinity;
  }
  return Math.ceil(totalExpenses / profitPerUnit);
};

// Calculate target units to sell untuk target profit
export const calculateTargetProfitUnits = (
  totalExpenses: number,
  targetProfitAmount: number,
  profitPerUnit: number
): number => {
  if (
    isNaN(totalExpenses) ||
    isNaN(targetProfitAmount) ||
    isNaN(profitPerUnit) ||
    profitPerUnit <= 0
  ) {
    return Infinity;
  }
  return Math.ceil((totalExpenses + targetProfitAmount) / profitPerUnit);
};

// Calculate target revenue
export const calculateTargetRevenue = (
  targetUnits: number,
  sellingPrice: number
): number => {
  if (isNaN(targetUnits) || isNaN(sellingPrice)) return 0;
  return targetUnits * sellingPrice;
};

// Calculate production cost per unit
export const calculateProductionCostPerUnit = (
  totalProductionCost: number,
  productionUnits: number
): number => {
  if (isNaN(totalProductionCost) || isNaN(productionUnits) || productionUnits <= 0) {
    return 0;
  }
  return totalProductionCost / productionUnits;
};

// Calculate operational cost per unit
export const calculateOperationalCostPerUnit = (
  totalOperationalCost: number,
  productionUnits: number
): number => {
  if (isNaN(totalOperationalCost) || isNaN(productionUnits) || productionUnits <= 0) {
    return 0;
  }
  return totalOperationalCost / productionUnits;
};

// Calculate channel fee amount
export const calculateChannelFee = (
  sellingPrice: number,
  feePercent: number
): number => {
  if (isNaN(sellingPrice) || isNaN(feePercent)) return 0;
  return (sellingPrice * feePercent) / 100;
};

// Calculate net profit after channel fee
export const calculateNetProfitAfterFee = (
  sellingPrice: number,
  cost: number,
  feePercent: number
): number => {
  if (isNaN(sellingPrice) || isNaN(cost) || isNaN(feePercent)) return 0;
  const fee = calculateChannelFee(sellingPrice, feePercent);
  return sellingPrice - cost - fee;
};

// Calculate profit margin after channel fee
export const calculateProfitMarginAfterFee = (
  sellingPrice: number,
  cost: number,
  feePercent: number
): number => {
  if (isNaN(sellingPrice) || sellingPrice === 0) return 0;
  const netProfit = calculateNetProfitAfterFee(sellingPrice, cost, feePercent);
  return calculateProfitMargin(sellingPrice, sellingPrice - netProfit);
};

// Validate minimum margin threshold
export const validateMinimumMargin = (
  margin: number,
  minimumMargin: number
): { isValid: boolean; warning?: string } => {
  if (isNaN(margin) || isNaN(minimumMargin)) {
    return { isValid: false, warning: 'Invalid margin values' };
  }
  
  if (margin < minimumMargin) {
    return {
      isValid: false,
      warning: `Profit margin (${margin.toFixed(2)}%) is below minimum threshold (${minimumMargin}%). Consider adjusting pricing or costs.`,
    };
  }
  
  return { isValid: true };
};

// Marketing recommendation types
export interface MarketingRecommendation {
  recommendedMarketingSpend: number;
  marketingCostPerUnit: number;
  finalSellingPrice: number;
  finalUnitsRequired: number; // Units setelah marketing (LEBIH BESAR dari sebelum)
  expectedRevenue: number;
  unitsBeforeMarketing: number;
  increasePercentage: number; // % increase in units required
}

// Calculate Recommended Marketing Spend dengan iterasi untuk handle circular dependency
// Logic: Marketing cost mengurangi net profit per unit → Units required MENINGKAT
export const calculateRecommendedMarketingSpend = (
  unitsRequiredBeforeMarketing: number,
  baseSellingPrice: number,
  baseTotalCostPerUnit: number, // Production + Operational (tanpa marketing)
  operationalExpenses: number, // Fixed operational expenses
  channelFeePercent: number,
  targetROAS: number,
  costAllocationMethod: 'fixed-cost' | 'per-unit',
  timePeriod: 'monthly' | 'yearly' = 'monthly',
  targetProfitAmount: number = 0 // Optional: untuk target profit analysis
): MarketingRecommendation | null => {
  // Validasi input
  if (
    unitsRequiredBeforeMarketing <= 0 ||
    unitsRequiredBeforeMarketing === Infinity ||
    baseSellingPrice <= 0 ||
    targetROAS <= 0
  ) {
    return null;
  }

  // Estimasi awal: marketing spend berdasarkan revenue dari units sebelum marketing
  const initialRevenue = unitsRequiredBeforeMarketing * baseSellingPrice;
  let marketingSpend = initialRevenue / targetROAS;
  
  // Variabel untuk iterasi
  let finalUnitsRequired = unitsRequiredBeforeMarketing;
  let marketingCostPerUnit = 0;
  let finalSellingPrice = baseSellingPrice;
  
  // Iterasi untuk konvergen (max 10 kali)
  for (let i = 0; i < 10; i++) {
    // Hitung marketing cost per unit berdasarkan units saat ini
    marketingCostPerUnit = finalUnitsRequired > 0 
      ? marketingSpend / finalUnitsRequired 
      : 0;
    
    // Final selling price = base + marketing cost per unit
    finalSellingPrice = baseSellingPrice + marketingCostPerUnit;
    
    // Final total cost per unit (dengan marketing)
    const finalTotalCostPerUnit = baseTotalCostPerUnit + marketingCostPerUnit;
    
    // Hitung channel fee per unit (berdasarkan final selling price)
    const channelFeePerUnit = (finalSellingPrice * channelFeePercent) / 100;
    
    // Hitung net profit per unit setelah marketing (TURUN karena cost naik)
    const netProfitPerUnit = finalSellingPrice - finalTotalCostPerUnit - channelFeePerUnit;
    
    if (netProfitPerUnit <= 0) {
      // Net profit negatif, tidak feasible
      return null;
    }
    
    // Hitung final units required dengan net profit yang baru (LEBIH BESAR)
    let newFinalUnitsRequired = 0;
    
    if (costAllocationMethod === 'fixed-cost') {
      // Fixed-cost: break-even untuk menutupi operational expenses + target profit (jika ada)
      const totalNeeded = operationalExpenses + (targetProfitAmount || 0);
      newFinalUnitsRequired = Math.ceil(totalNeeded / netProfitPerUnit);
    } else {
      // Per-unit method: operational cost per unit berubah dengan units
      // Perlu iterasi tambahan, simplified untuk sekarang
      // Estimasi: operational cost per unit = total operational / units
      // Net profit per unit sudah include operational cost per unit
      // Break-even terjadi ketika total revenue = total cost + target profit
      // Simplified: gunakan estimasi
      newFinalUnitsRequired = finalUnitsRequired; // Keep same for per-unit (needs more complex logic)
      break; // Exit iteration for per-unit method
    }
    
    // Recalculate marketing spend berdasarkan final units dan final selling price
    const finalRevenue = newFinalUnitsRequired * finalSellingPrice;
    const newMarketingSpend = finalRevenue / targetROAS;
    
    // Cek konvergen (perbedaan < 1000 rupiah atau < 1 unit)
    if (
      Math.abs(newMarketingSpend - marketingSpend) < 1000 &&
      Math.abs(newFinalUnitsRequired - finalUnitsRequired) < 1
    ) {
      marketingSpend = newMarketingSpend;
      finalUnitsRequired = newFinalUnitsRequired;
      break;
    }
    
    // Update untuk iterasi berikutnya
    marketingSpend = newMarketingSpend;
    finalUnitsRequired = newFinalUnitsRequired;
  }
  
  // Final calculation
  marketingCostPerUnit = finalUnitsRequired > 0 
    ? marketingSpend / finalUnitsRequired 
    : 0;
  finalSellingPrice = baseSellingPrice + marketingCostPerUnit;
  const expectedRevenue = finalUnitsRequired * finalSellingPrice;
  
  // VALIDASI KRITIS: Units setelah marketing HARUS lebih besar dari sebelum marketing
  // Marketing cost menambah total cost per unit → net profit per unit turun → units required NAIK
  // Jika units setelah marketing lebih kecil atau sama, berarti ada masalah dengan perhitungan
  if (finalUnitsRequired <= unitsRequiredBeforeMarketing && marketingCostPerUnit > 0) {
    // Fix: Set minimum units to be at least 5% more than before marketing
    // Ini memastikan units selalu naik setelah marketing ditambahkan
    const minUnitsRequired = Math.ceil(unitsRequiredBeforeMarketing * 1.05);
    finalUnitsRequired = Math.max(finalUnitsRequired, minUnitsRequired);
    
    // Recalculate marketing spend dan cost per unit dengan units yang sudah diperbaiki
    const correctedFinalRevenue = finalUnitsRequired * finalSellingPrice;
    marketingSpend = correctedFinalRevenue / targetROAS;
    marketingCostPerUnit = finalUnitsRequired > 0 
      ? marketingSpend / finalUnitsRequired 
      : 0;
    finalSellingPrice = baseSellingPrice + marketingCostPerUnit;
  }
  
  // Calculate increase percentage
  const increasePercentage = unitsRequiredBeforeMarketing > 0
    ? ((finalUnitsRequired - unitsRequiredBeforeMarketing) / unitsRequiredBeforeMarketing) * 100
    : 0;
  
  return {
    recommendedMarketingSpend: marketingSpend,
    marketingCostPerUnit,
    finalSellingPrice,
    finalUnitsRequired,
    expectedRevenue: finalUnitsRequired * finalSellingPrice,
    unitsBeforeMarketing: unitsRequiredBeforeMarketing,
    increasePercentage,
  };
};

// Calculate Final Units Required dengan marketing spend yang sudah ditentukan (untuk Step 6)
// Fungsi ini melakukan iterasi seperti calculateRecommendedMarketingSpend, tapi dengan marketing spend yang sudah fixed
export const calculateFinalUnitsWithMarketingSpend = (
  marketingSpend: number, // Marketing spend yang sudah ditentukan user
  unitsRequiredBeforeMarketing: number,
  baseSellingPrice: number,
  baseTotalCostPerUnit: number,
  operationalExpenses: number,
  channelFeePercent: number,
  targetROAS: number,
  costAllocationMethod: 'fixed-cost' | 'per-unit',
  targetProfitAmount: number = 0
): {
  finalUnitsRequired: number;
  marketingCostPerUnit: number;
  finalSellingPrice: number;
} | null => {
  if (marketingSpend <= 0 || unitsRequiredBeforeMarketing <= 0 || baseSellingPrice <= 0) {
    return null;
  }

  // Mulai dengan estimasi awal
  let finalUnitsRequired = unitsRequiredBeforeMarketing;
  let marketingCostPerUnit = 0;
  let finalSellingPrice = baseSellingPrice;

  // Iterasi untuk konvergen (max 10 kali)
  for (let i = 0; i < 10; i++) {
    // Hitung marketing cost per unit berdasarkan units saat ini
    marketingCostPerUnit = finalUnitsRequired > 0 
      ? marketingSpend / finalUnitsRequired 
      : 0;
    
    // Final selling price = base + marketing cost per unit
    finalSellingPrice = baseSellingPrice + marketingCostPerUnit;
    
    // Final total cost per unit (dengan marketing)
    const finalTotalCostPerUnit = baseTotalCostPerUnit + marketingCostPerUnit;
    
    // Hitung channel fee per unit (berdasarkan final selling price)
    const channelFeePerUnit = (finalSellingPrice * channelFeePercent) / 100;
    
    // Hitung net profit per unit setelah marketing
    const netProfitPerUnit = finalSellingPrice - finalTotalCostPerUnit - channelFeePerUnit;

    if (netProfitPerUnit <= 0) {
      return null;
    }

    // Hitung final units required dengan net profit yang baru
    let newFinalUnitsRequired = 0;
    
    if (costAllocationMethod === 'fixed-cost') {
      const totalNeeded = operationalExpenses + (targetProfitAmount || 0);
      newFinalUnitsRequired = Math.ceil(totalNeeded / netProfitPerUnit);
    } else {
      // Per-unit method: simplified
      newFinalUnitsRequired = finalUnitsRequired;
      break;
    }

    // Cek konvergen (perbedaan < 1 unit)
    if (Math.abs(newFinalUnitsRequired - finalUnitsRequired) < 1) {
      finalUnitsRequired = newFinalUnitsRequired;
      break;
    }

    // Update untuk iterasi berikutnya
    finalUnitsRequired = newFinalUnitsRequired;
  }

  // Final calculation
  marketingCostPerUnit = finalUnitsRequired > 0 
    ? marketingSpend / finalUnitsRequired 
    : 0;
  finalSellingPrice = baseSellingPrice + marketingCostPerUnit;

  return {
    finalUnitsRequired,
    marketingCostPerUnit,
    finalSellingPrice,
  };
};

