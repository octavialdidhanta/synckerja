import { useState, useCallback, useRef } from "react";
import { History, GitCompare, Calculator } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { PricingToolsModuleShell } from "../layout/PricingToolsModuleShell";
import {
  PricingToolsLayout,
  PricingToolsSidebar,
  CalculationHistoryViewer,
  MultipleProductComparison,
} from "../components";
import type { PricingCalculationResult, PricingCalculationInput } from "../types/pricingTypes";
import type { SavedCalculation } from "../hooks/usePricingCalculations";
import type { PricingWizardRef } from "../components/PricingWizard";

const MAIN_INNER_SCROLL =
  "scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const PricingToolsPage = () => {
  const { t } = useAppTranslation();
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  /** Short debounce only to absorb org/bootstrap flicker; keeps skeleton ↔ live layout aligned. */
  const showContent = useDebouncedReady(!orgLoading, 120);

  const [activeView, setActiveView] = useState<"calculator" | "history" | "comparison">("calculator");
  const [calculationResults, setCalculationResults] = useState<PricingCalculationResult | null>(null);
  const [calculationInput, setCalculationInput] = useState<PricingCalculationInput | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [finalSellingPrice, setFinalSellingPrice] = useState<number | undefined>(undefined);
  const [marketingCostPerUnit, setMarketingCostPerUnit] = useState<number | undefined>(undefined);
  const [channelFeePercent, setChannelFeePercent] = useState<number | undefined>(undefined);
  const [baseTotalCostPerUnit, setBaseTotalCostPerUnit] = useState<number | undefined>(undefined);
  const wizardRef = useRef<PricingWizardRef>(null);

  const handleCalculate = useCallback(
    (results: PricingCalculationResult, input: PricingCalculationInput) => {
      setCalculationResults(results);
      setCalculationInput(input);
    },
    [],
  );

  const handleStepChange = useCallback(
    (data: {
      currentStep: number;
      finalSellingPrice?: number;
      marketingCostPerUnit?: number;
      channelFeePercent?: number;
      baseTotalCostPerUnit?: number;
    }) => {
      setCurrentStep(data.currentStep);
      setFinalSellingPrice(data.finalSellingPrice);
      setMarketingCostPerUnit(data.marketingCostPerUnit);
      setChannelFeePercent(data.channelFeePercent);
      setBaseTotalCostPerUnit(data.baseTotalCostPerUnit);
    },
    [],
  );

  const handleLoadCalculation = useCallback((calculation: SavedCalculation) => {
    setActiveView("calculator");
    window.setTimeout(() => {
      wizardRef.current?.loadCalculation(calculation);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 100);
  }, []);

  return (
    <PricingToolsModuleShell showContent={showContent}>
      {/* Match synckerja-reference: toolbar above the 9+3 grid (not a third grid row). */}
      <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="mb-2 flex shrink-0 flex-wrap gap-2 px-1">
          <Button
            variant={activeView === "calculator" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveView("calculator")}
            className="text-xs"
          >
            <Calculator className="mr-1 h-3 w-3" />
            {t("pricingTools.views.calculator", "Kalkulator")}
          </Button>
          <Button
            variant={activeView === "history" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveView("history")}
            className="text-xs"
          >
            <History className="mr-1 h-3 w-3" />
            {t("pricingTools.views.history", "Riwayat")}
          </Button>
          <Button
            variant={activeView === "comparison" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveView("comparison")}
            className="text-xs"
          >
            <GitCompare className="mr-1 h-3 w-3" />
            {t("pricingTools.views.comparison", "Perbandingan")}
          </Button>
        </div>

        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
          <div className="col-span-12 flex min-h-0 min-w-0 xl:col-span-9">
            <div className="flex h-full min-h-0 w-full min-w-0 flex-col rounded-lg border border-primary/15 bg-card shadow-sm ring-1 ring-primary/5">
              <div className="flex min-h-0 flex-1 flex-col">
                <div className={`${MAIN_INNER_SCROLL} px-6 py-6`}>
                  {!organizationId ? (
                    <p className="text-sm text-muted-foreground">
                      {t("pricingTools.noOrganization", "Pilih organisasi aktif untuk menggunakan alat harga.")}
                    </p>
                  ) : null}
                  {organizationId && activeView === "calculator" ? (
                    <PricingToolsLayout
                      ref={wizardRef}
                      onCalculate={handleCalculate}
                      onStepChange={handleStepChange}
                    />
                  ) : null}
                  {organizationId && activeView === "history" ? (
                    <CalculationHistoryViewer onLoadCalculation={handleLoadCalculation} />
                  ) : null}
                  {organizationId && activeView === "comparison" ? (
                    <MultipleProductComparison
                      currentCalculation={
                        calculationResults
                          ? {
                              name: calculationInput?.productName || "Current Calculation",
                              result: calculationResults,
                            }
                          : null
                      }
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-12 flex h-full min-h-0 min-w-0 xl:col-span-3">
            {activeView === "calculator" ? (
              <div className="flex h-full min-h-0 w-full min-w-0 flex-col rounded-lg border border-primary/15 bg-card shadow-sm ring-1 ring-primary/5">
                <div className={`${MAIN_INNER_SCROLL} px-6 py-6`}>
                  <PricingToolsSidebar
                    calculationResults={calculationResults}
                    calculationInput={calculationInput || undefined}
                    currentStep={currentStep}
                    finalSellingPrice={finalSellingPrice}
                    marketingCostPerUnit={marketingCostPerUnit}
                    channelFeePercent={channelFeePercent}
                    baseTotalCostPerUnit={baseTotalCostPerUnit}
                  />
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-0 w-full min-w-0 flex-col space-y-2 rounded-lg border border-primary/15 bg-card p-4 shadow-sm ring-1 ring-primary/5">
                {activeView === "history" ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {t(
                      "pricingTools.sidebar.historyHint",
                      "Pilih perhitungan dari daftar untuk memuatnya ke kalkulator.",
                    )}
                  </p>
                ) : null}
                {activeView === "comparison" ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {t(
                      "pricingTools.sidebar.comparisonHint",
                      "Pilih produk dari daftar untuk membandingkannya.",
                    )}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </PricingToolsModuleShell>
  );
};

export default PricingToolsPage;
