import { useState } from "react";
import { CalculatorModuleShell } from "@/8-3-calculator/layout/CalculatorModuleShell";
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
      <div className="col-span-12 flex min-h-0 min-w-0 flex-col xl:col-span-9">
        <div className="flex h-full min-h-0 min-w-0 flex-col rounded-lg border border-primary/15 bg-card shadow-sm ring-1 ring-primary/5">
          <div className="flex min-h-0 flex-1 flex-col">
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
          </div>
          <CalculatorMainFooter activeTab="sales" />
        </div>
      </div>

      <TutorialSidebar activeTab="sales" />
    </CalculatorModuleShell>
  );
};

export default CalculatorSalesPage;
