import {
  PricingCalculationInput,
  PricingCalculationResult,
  ChannelPricingResult,
  BreakEvenAnalysis,
  TargetProfitAnalysis,
  PricingCalculationWarnings,
} from "../types/pricingTypes";
import {
  calculateSellingPriceByMarkup,
  calculateSellingPriceByMargin,
  calculateSellingPriceByFixedProfit,
  calculateProfitMargin,
  calculateMarkup,
  calculateBreakEvenUnits,
  calculateTargetProfitUnits,
  calculateTargetRevenue,
  calculateChannelFee,
  calculateNetProfitAfterFee,
  calculateProfitMarginAfterFee,
  validateMinimumMargin,
} from "./pricingUtils";

export const calculatePricing = (
  input: PricingCalculationInput
): PricingCalculationResult => {
  // Production cost per unit langsung dari input (sudah dihitung di DynamicCostBreakdown)
  const productionCostPerUnit = input.productionCostPerUnit;

  // Untuk perhitungan awal, kita perlu estimasi unit untuk menghitung operational cost per unit
  // jika menggunakan per-unit method. Gunakan estimasi awal 1000 unit.
  const estimatedUnitsForInitialCalculation = 1000;
  
  // Calculate operational cost per unit (untuk per-unit allocation)
  // Untuk per-unit method: totalOperationalExpenses adalah total, perlu dibagi dengan estimasi unit
  // Untuk fixed-cost: operational expenses adalah total bulanan (tidak perlu cost per unit)
  let operationalCostPerUnit = 0;
  if (input.costAllocationMethod === 'per-unit') {
    operationalCostPerUnit = input.totalOperationalExpenses / estimatedUnitsForInitialCalculation;
  }

  // Calculate total cost per unit (untuk menghitung harga jual)
  const totalCostPerUnit = productionCostPerUnit + operationalCostPerUnit;

  // Calculate base selling price based on method
  let baseSellingPrice = 0;
  if (input.calculationMethod === 'markup' && input.markupPercent !== undefined) {
    baseSellingPrice = calculateSellingPriceByMarkup(totalCostPerUnit, input.markupPercent);
  } else if (input.calculationMethod === 'margin' && input.marginPercent !== undefined) {
    baseSellingPrice = calculateSellingPriceByMargin(totalCostPerUnit, input.marginPercent);
  } else if (input.calculationMethod === 'fixed' && input.fixedProfit !== undefined) {
    baseSellingPrice = calculateSellingPriceByFixedProfit(totalCostPerUnit, input.fixedProfit);
  }

  // Calculate base profit per unit
  const profitPerUnit = baseSellingPrice - totalCostPerUnit;
  const profitMarginPercent = calculateProfitMargin(baseSellingPrice, totalCostPerUnit);
  const markupPercent = calculateMarkup(baseSellingPrice, totalCostPerUnit);

  // Calculate channel pricing for active selected channels
  const channelPricing: ChannelPricingResult[] = input.salesChannels
    .filter((channel) => channel.isActive && input.selectedChannels.includes(channel.id))
    .map((channel) => {
      const sellingPrice = baseSellingPrice;
      const fees = calculateChannelFee(sellingPrice, channel.totalFeePercent);
      const netProfit = calculateNetProfitAfterFee(
        sellingPrice,
        totalCostPerUnit,
        channel.totalFeePercent
      );
      const channelMargin = calculateProfitMarginAfterFee(
        sellingPrice,
        totalCostPerUnit,
        channel.totalFeePercent
      );

      return {
        channelId: channel.id,
        channelName: channel.name,
        sellingPrice,
        fees,
        netProfit,
        profitMargin: channelMargin,
        costPerUnit: totalCostPerUnit,
      };
    });

  // Find recommended channel (highest margin) - ini adalah channel terbaik untuk digunakan
  const recommendedChannel = channelPricing.length > 0
    ? channelPricing.reduce((best, current) =>
        current.profitMargin > best.profitMargin ? current : best
      )
    : null;

  // Find worst channel (lowest margin / highest fee) - untuk validasi margin warning
  // Ini penting untuk memastikan margin masih acceptable bahkan di channel terburuk
  const worstChannel = channelPricing.length > 0
    ? channelPricing.reduce((worst, current) =>
        current.profitMargin < worst.profitMargin ? current : worst
      )
    : null;

  // Gunakan recommended channel untuk semua perhitungan (bukan worst case)
  // Recommended channel adalah channel dengan margin terbaik, jadi target unit akan lebih realistis
  const recommendedChannelFeePercent = recommendedChannel
    ? input.salesChannels.find(c => c.id === recommendedChannel.channelId)?.totalFeePercent || 0
    : 0;

  // Net profit per unit setelah sales channel fee menggunakan recommended channel
  // Ini akan menghasilkan target unit yang lebih realistis karena menggunakan channel terbaik
  const netProfitPerUnit = recommendedChannelFeePercent > 0 && recommendedChannel
    ? recommendedChannel.netProfit // Langsung gunakan netProfit dari recommended channel
    : profitPerUnit; // Jika tidak ada channel fee, gunakan profit per unit biasa

  // Recommended selling price untuk perhitungan
  // Semua channel menggunakan baseSellingPrice yang sama, jadi gunakan baseSellingPrice
  // Ini adalah harga jual yang direkomendasikan (sebelum sales channel fee)
  const effectiveSellingPrice = baseSellingPrice;

  // Calculate break-even units
  // KONSEP BREAK-EVEN YANG BENAR:
  // Break-even berarti: Profit = 0 (tidak untung, tidak rugi)
  // 
  // Untuk fixed-cost method:
  // - Net Profit per Unit = Selling Price - Production Cost per Unit - Channel Fee (sudah termasuk semua cost variable)
  // - Operational Cost adalah FIXED (tidak tergantung jumlah unit)
  // - Break-even: Total Net Profit = Operational Cost
  // - Units × Net Profit per Unit = Operational Cost
  // - Break-Even Units = Operational Cost ÷ Net Profit per Unit
  // 
  // Untuk per-unit method:
  // - Net Profit per Unit = Selling Price - Production Cost per Unit - Operational Cost per Unit - Channel Fee
  // - Karena semua cost sudah included dalam Net Profit per Unit, maka Break-Even Units = 0 (selalu profit)
  // - Tapi untuk konsistensi, kita hitung berdasarkan estimasi initial
  //
  // CATATAN PENTING: Channel fee tergantung pada gross revenue (units × selling price),
  // jadi kita perlu iterasi untuk konvergen ke nilai yang tepat.
  
  let breakEvenUnits = 0;
  let breakEvenChannelFee = 0;
  let breakEvenRevenue = 0;
  let breakEvenProductionCost = 0;
  let breakEvenOperationalCost = 0;
  
  if (input.costAllocationMethod === 'fixed-cost') {
    // Fixed-cost: Break-even hanya untuk menutupi operational cost
    // Net profit per unit sudah dikurangi production cost dan channel fee
    
    // Estimasi awal: gunakan net profit per unit yang sudah dihitung
    if (netProfitPerUnit > 0) {
      breakEvenUnits = Math.ceil(input.totalOperationalExpenses / netProfitPerUnit);
    } else {
      breakEvenUnits = Infinity;
    }
    
    // Iterasi untuk memperhitungkan channel fee yang tergantung pada revenue
    if (breakEvenUnits !== Infinity && breakEvenUnits > 0 && effectiveSellingPrice > 0) {
      for (let i = 0; i < 10; i++) {
        // Hitung revenue dari units
        breakEvenRevenue = breakEvenUnits * effectiveSellingPrice;
        
        // Hitung channel fee dari revenue
        if (recommendedChannelFeePercent > 0) {
          breakEvenChannelFee = (breakEvenRevenue * recommendedChannelFeePercent) / 100;
        } else {
          breakEvenChannelFee = 0;
        }
        
        // Recalculate net profit per unit dengan channel fee yang baru
        // Net Profit = Selling Price - Production Cost per Unit - Channel Fee per Unit
        const channelFeePerUnit = recommendedChannelFeePercent > 0 
          ? (breakEvenRevenue * recommendedChannelFeePercent) / 100 / breakEvenUnits
          : 0;
        const recalculatedNetProfitPerUnit = effectiveSellingPrice - productionCostPerUnit - channelFeePerUnit;
        
        // Hitung break-even units baru
        if (recalculatedNetProfitPerUnit > 0) {
          const newBreakEvenUnits = Math.ceil(input.totalOperationalExpenses / recalculatedNetProfitPerUnit);
          
          // Cek konvergen (perbedaan < 1 unit)
          if (Math.abs(newBreakEvenUnits - breakEvenUnits) < 1) {
            breakEvenUnits = newBreakEvenUnits;
            break;
          }
          
          breakEvenUnits = newBreakEvenUnits;
        } else {
          breakEvenUnits = Infinity;
          break;
        }
      }
      
      // SETELAH ITERASI, PASTIKAN UNITS = REVENUE ÷ SELLING PRICE (EXACT MATCH)
      // Recalculate final values
      breakEvenRevenue = breakEvenUnits * effectiveSellingPrice;
      if (recommendedChannelFeePercent > 0) {
        breakEvenChannelFee = (breakEvenRevenue * recommendedChannelFeePercent) / 100;
      }
      
      // Calculate breakdown untuk display
      breakEvenProductionCost = productionCostPerUnit * breakEvenUnits;
      breakEvenOperationalCost = input.totalOperationalExpenses;
    } else {
      breakEvenRevenue = 0;
      breakEvenProductionCost = 0;
      breakEvenOperationalCost = input.totalOperationalExpenses;
    }
  } else {
    // Per-unit method: Net profit per unit sudah include operational cost per unit
    // Jadi break-even units lebih kompleks karena operational cost tergantung unit
    const estimatedTotalProductionCost = productionCostPerUnit * estimatedUnitsForInitialCalculation;
    const estimatedTotalOperationalCost = operationalCostPerUnit * estimatedUnitsForInitialCalculation;
    const estimatedTotalExpenses = estimatedTotalProductionCost + estimatedTotalOperationalCost;
    
    breakEvenUnits = calculateBreakEvenUnits(estimatedTotalExpenses, netProfitPerUnit);
    
    // Iterasi untuk per-unit method (karena operational cost per unit tergantung jumlah unit)
    if (breakEvenUnits !== Infinity && breakEvenUnits > 0 && effectiveSellingPrice > 0 && netProfitPerUnit > 0) {
      for (let i = 0; i < 10; i++) {
        // Hitung revenue dari units
        breakEvenRevenue = breakEvenUnits * effectiveSellingPrice;
        
        // Hitung channel fee dari revenue
        if (recommendedChannelFeePercent > 0) {
          breakEvenChannelFee = (breakEvenRevenue * recommendedChannelFeePercent) / 100;
        } else {
          breakEvenChannelFee = 0;
        }
        
        // Recalculate operational cost per unit
        const recalculatedOperationalCostPerUnit = input.totalOperationalExpenses / breakEvenUnits;
        const recalculatedTotalCostPerUnit = productionCostPerUnit + recalculatedOperationalCostPerUnit;
        
        // Recalculate net profit per unit
        const recalculatedNetProfitPerUnit = recommendedChannelFeePercent > 0
          ? calculateNetProfitAfterFee(effectiveSellingPrice, recalculatedTotalCostPerUnit, recommendedChannelFeePercent)
          : (effectiveSellingPrice - recalculatedTotalCostPerUnit);
        
        // Calculate total expenses untuk break-even
        const totalProductionCost = productionCostPerUnit * breakEvenUnits;
        const totalOperationalCost = recalculatedOperationalCostPerUnit * breakEvenUnits;
        const totalExpenses = totalProductionCost + totalOperationalCost + breakEvenChannelFee;
        
        // Hitung break-even units baru
        if (recalculatedNetProfitPerUnit > 0) {
          const newBreakEvenUnits = Math.ceil(totalExpenses / recalculatedNetProfitPerUnit);
          
          // Cek konvergen (perbedaan < 1 unit)
          if (Math.abs(newBreakEvenUnits - breakEvenUnits) < 1) {
            breakEvenUnits = newBreakEvenUnits;
            break;
          }
          
          breakEvenUnits = newBreakEvenUnits;
        } else {
          breakEvenUnits = Infinity;
          break;
        }
      }
      
      // Recalculate final values
      breakEvenRevenue = breakEvenUnits * effectiveSellingPrice;
      if (recommendedChannelFeePercent > 0) {
        breakEvenChannelFee = (breakEvenRevenue * recommendedChannelFeePercent) / 100;
      }
      
      const finalOperationalCostPerUnit = input.totalOperationalExpenses / breakEvenUnits;
      breakEvenProductionCost = productionCostPerUnit * breakEvenUnits;
      breakEvenOperationalCost = finalOperationalCostPerUnit * breakEvenUnits;
    } else {
      breakEvenRevenue = estimatedTotalExpenses;
      breakEvenProductionCost = productionCostPerUnit * breakEvenUnits;
      breakEvenOperationalCost = operationalCostPerUnit * breakEvenUnits;
    }
  }
  
  // Total expenses untuk display (bukan untuk perhitungan break-even units)
  // Ini menunjukkan total cost structure untuk break-even units
  const totalExpenses = breakEvenProductionCost + breakEvenOperationalCost + breakEvenChannelFee;
  
  // Recalculate operational cost per unit untuk per-unit method berdasarkan break-even units
  // Ini lebih akurat daripada estimasi awal
  if (input.costAllocationMethod === 'per-unit' && breakEvenUnits > 0 && breakEvenUnits !== Infinity) {
    operationalCostPerUnit = input.totalOperationalExpenses / breakEvenUnits;
  }
  
  // Estimate months to break-even hanya untuk yearly period
  let monthsToBreakEven: number | undefined;
  if (input.timePeriod === 'yearly' && profitPerUnit > 0) {
    monthsToBreakEven = undefined;
  }

  const breakEven: BreakEvenAnalysis = {
    unitsRequired: breakEvenUnits,
    revenueRequired: breakEvenRevenue,
    monthsToBreakEven,
    // Tambahkan breakdown
    totalExpenses,
    productionCost: breakEvenProductionCost,
    operationalCost: breakEvenOperationalCost,
    channelFee: breakEvenChannelFee,
    netProfitPerUnit,
  };

  // Calculate target profit analysis
  let targetProfit: TargetProfitAnalysis | null = null;
  if (input.targetProfitPercent !== undefined && input.targetProfitPercent > 0) {
    // Logika perhitungan iteratif untuk memastikan Units Required = Revenue Required / Recommended Selling Price
    // Karena channel fee tergantung pada gross revenue, kita perlu iterasi hingga konvergen
    
    let targetUnits = 0;
    let totalCost = 0;
    let actualTargetProfitAmount = 0;
    let targetRevenue = 0;
    let channelFee = 0;
    let productionCost = 0;
    let operationalCost = 0;
    
    // Estimasi awal: hitung tanpa channel fee
    if (input.costAllocationMethod === 'fixed-cost') {
      // Gunakan break-even units sebagai estimasi awal
      productionCost = productionCostPerUnit * breakEvenUnits;
      operationalCost = input.totalOperationalExpenses;
    } else {
      productionCost = productionCostPerUnit * breakEvenUnits;
      operationalCost = operationalCostPerUnit * breakEvenUnits;
    }
    
    totalCost = productionCost + operationalCost; // Tanpa channel fee dulu
    actualTargetProfitAmount = (totalCost * input.targetProfitPercent) / 100;
    targetRevenue = totalCost + actualTargetProfitAmount;
    
    // Iterasi untuk konvergen (max 10 iterasi untuk menghindari infinite loop)
    for (let i = 0; i < 10; i++) {
      // Hitung target units berdasarkan revenue required dan selling price
      if (effectiveSellingPrice > 0) {
        // Gunakan Math.round untuk akurasi yang lebih baik
        targetUnits = Math.round(targetRevenue / effectiveSellingPrice);
        // Jika hasil 0 atau negatif, gunakan Math.ceil
        if (targetUnits <= 0) {
          targetUnits = Math.ceil(targetRevenue / effectiveSellingPrice);
        }
      } else {
        targetUnits = Infinity;
        break;
      }
      
      // Hitung ulang costs berdasarkan target units
      if (input.costAllocationMethod === 'fixed-cost') {
        productionCost = productionCostPerUnit * targetUnits;
        operationalCost = input.totalOperationalExpenses;
      } else {
        if (targetUnits > 0) {
          const recalculatedOperationalCostPerUnit = input.totalOperationalExpenses / targetUnits;
          productionCost = productionCostPerUnit * targetUnits;
          operationalCost = recalculatedOperationalCostPerUnit * targetUnits;
        } else {
          productionCost = 0;
          operationalCost = 0;
        }
      }
      
      // Hitung channel fee berdasarkan gross revenue
      if (recommendedChannelFeePercent > 0 && targetUnits > 0) {
        const grossRevenueForTargetUnits = targetUnits * effectiveSellingPrice;
        channelFee = (grossRevenueForTargetUnits * recommendedChannelFeePercent) / 100;
      } else {
        channelFee = 0;
      }
      
      // Hitung total cost (termasuk channel fee)
      const newTotalCost = productionCost + operationalCost + channelFee;
      
      // Hitung ulang target profit amount
      const newTargetProfitAmount = (newTotalCost * input.targetProfitPercent) / 100;
      
      // Hitung ulang revenue required
      const newTargetRevenue = newTotalCost + newTargetProfitAmount;
      
      // Cek apakah sudah konvergen (perbedaan < 1 rupiah)
      if (Math.abs(newTargetRevenue - targetRevenue) < 1) {
        totalCost = newTotalCost;
        actualTargetProfitAmount = newTargetProfitAmount;
        targetRevenue = newTargetRevenue;
        break;
      }
      
      // Update untuk iterasi berikutnya
      totalCost = newTotalCost;
      actualTargetProfitAmount = newTargetProfitAmount;
      targetRevenue = newTargetRevenue;
    }

    // SETELAH ITERASI SELESAI, PASTIKAN UNITS = REVENUE ÷ SELLING PRICE (EXACT MATCH)
    // Ini memastikan konsistensi mutlak
    if (effectiveSellingPrice > 0 && targetRevenue > 0) {
      targetUnits = Math.round(targetRevenue / effectiveSellingPrice);
      
      // Recalculate semua dengan units yang sudah disesuaikan
      if (input.costAllocationMethod === 'fixed-cost') {
        productionCost = productionCostPerUnit * targetUnits;
        operationalCost = input.totalOperationalExpenses;
      } else {
        if (targetUnits > 0) {
          const recalculatedOperationalCostPerUnit = input.totalOperationalExpenses / targetUnits;
          productionCost = productionCostPerUnit * targetUnits;
          operationalCost = recalculatedOperationalCostPerUnit * targetUnits;
        } else {
          productionCost = 0;
          operationalCost = 0;
        }
      }
      
      // Recalculate channel fee dengan units yang sudah disesuaikan
      if (recommendedChannelFeePercent > 0 && targetUnits > 0) {
        const grossRevenueForTargetUnits = targetUnits * effectiveSellingPrice;
        channelFee = (grossRevenueForTargetUnits * recommendedChannelFeePercent) / 100;
      } else {
        channelFee = 0;
      }
      
      // Recalculate total cost dengan channel fee yang baru
      totalCost = productionCost + operationalCost + channelFee;
      actualTargetProfitAmount = (totalCost * input.targetProfitPercent) / 100;
      // Revenue harus = Total Cost + Target Profit
      targetRevenue = totalCost + actualTargetProfitAmount;
    }

    // Estimate months to target hanya untuk yearly period
    let monthsToTarget: number | undefined;
    if (input.timePeriod === 'yearly' && profitPerUnit > 0) {
      monthsToTarget = undefined;
    }

    targetProfit = {
      totalCost, // Total biaya yang digunakan untuk menghitung target profit (berdasarkan target units), termasuk channel fee
      productionCost, // Breakdown: Biaya produksi (production cost per unit × target units)
      operationalCost, // Breakdown: Biaya operasional
      channelFee, // Breakdown: Biaya sales channel fee (untuk target units)
      targetProfitAmount: actualTargetProfitAmount,
      unitsRequired: targetUnits,
      revenueRequired: targetRevenue,
      monthsToTarget,
    };
  }

  // Validate minimum margin berdasarkan margin setelah channel fee yang terendah (worst case)
  // Ini memastikan margin masih acceptable bahkan di channel dengan fee tertinggi
  const marginForValidation = worstChannel
    ? worstChannel.profitMargin // Gunakan margin terendah (channel dengan fee tertinggi)
    : profitMarginPercent; // Fallback ke base margin jika tidak ada channel
  const marginValidation = validateMinimumMargin(marginForValidation, input.minimumMarginPercent);
  
  // Check for unrealistic targets
  let unrealisticTargetMessage: string | undefined;
  if (breakEvenUnits === Infinity || (targetProfit && targetProfit.unitsRequired === Infinity)) {
    unrealisticTargetMessage = 'Profit per unit is too low to reach break-even or target profit. Please adjust pricing or costs.';
  } else if (targetProfit && targetProfit.unitsRequired > breakEvenUnits * 10) {
    unrealisticTargetMessage = 'Target profit requires significantly more units than break-even. Consider if this is achievable.';
  } else if (netProfitPerUnit <= 0 && (breakEvenUnits !== Infinity || (targetProfit && targetProfit.unitsRequired !== Infinity))) {
    unrealisticTargetMessage = 'Net profit per unit after sales channel fee is zero or negative. Please adjust pricing or reduce channel fees.';
  }

  const warnings: PricingCalculationWarnings = {
    lowMargin: !marginValidation.isValid,
    lowMarginMessage: marginValidation.warning,
    unrealisticTarget: unrealisticTargetMessage,
  };

  return {
    baseSellingPrice,
    totalCostPerUnit,
    profitPerUnit,
    profitMarginPercent,
    markupPercent,
    channelPricing,
    breakEven,
    targetProfit,
    warnings,
    summary: {
      totalExpenses,
      recommendedSellingPrice: recommendedChannel?.sellingPrice || baseSellingPrice,
      recommendedChannel: recommendedChannel?.channelName,
      productionCostPerUnit,
      operationalCostPerUnit,
    },
  };
};
