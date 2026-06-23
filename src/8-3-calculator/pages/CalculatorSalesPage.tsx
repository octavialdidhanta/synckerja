import { useState } from "react";
import { CalculatorModuleShell } from "@/8-3-calculator/layout/CalculatorModuleShell";
import {
  CALCULATOR_MAIN_CARD,
  CALCULATOR_MAIN_GRID,
  CALCULATOR_MAIN_SECTION,
} from "@/8-3-calculator/layout/calculatorLayout";
import { TutorialSidebar } from "@/8-3-calculator/components/TutorialSidebar";
import CalculatorMainFooter from "@/8-3-calculator/components/CalculatorMainFooter";
import SalesCalculator from "@/8-3-calculator/components/sales/SalesCalculator";
import type { SalesKPISettings } from "@/8-3-calculator/types/kpi-templates";

const CalculatorSalesPage = () => {
  const [salesSettings, setSalesSettings] = useState<SalesKPISettings>({
    budget: "",
    cpc: "",
    landingPageCtr: "",
    productViewRate: "",
    addToCartRate: "",
    checkoutRate: "",
    paymentSuccessRate: "",
    productPrice: "",
    avgOrderValue: "",
    profitMargin: "",
    repeatPurchaseRate: "",
    upsellRate: "",
    seasonalMultiplier: "",
  });

  return (
    <CalculatorModuleShell>
      <div className={CALCULATOR_MAIN_GRID}>
        <div className="col-span-9 flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden">
          <div className={CALCULATOR_MAIN_SECTION}>
            <div className={CALCULATOR_MAIN_CARD}>
              <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="space-y-4 pb-4">
                  <div className="overflow-hidden rounded-lg border border-primary/15 bg-card shadow-sm ring-1 ring-primary/5">
                    <div className="p-6">
                      <SalesCalculator
                        initialSettings={salesSettings}
                        onSettingsChange={(settings) => {
                          setSalesSettings(settings);
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <CalculatorMainFooter activeTab="sales" />
            </div>
          </div>
        </div>

        <TutorialSidebar activeTab="sales" />
      </div>
    </CalculatorModuleShell>
  );
};

export default CalculatorSalesPage;
