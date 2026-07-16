import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import {
  formatIDR,
  sumSelectedCatalogAddOnsListAmountIdr,
  summarizeAddOnSelectionsForDisplay,
} from "@/10-subscription/shared/subscriptionUtils";
import { resolveBillingPeriodMonths, formatBillingTermLabel } from "@/10-subscription/shared/billingTermUtils";
import type { BillingTermMonths } from "@/10-subscription/shared/billingTermUtils";
import type { SubscriptionPlan } from "@/10-subscription/types/SubscriptionPlanCatalog";
import { cn } from "@/shared/lib/utils";
import { PlanAddOnCatalogRows } from "./PlanAddOnCatalogRows";

type PlanAddOnsPanelProps = {
  plan: SubscriptionPlan;
  memberCount: number;
  billingCycle: "monthly" | "yearly";
  billingTermMonths?: BillingTermMonths;
  addOnSelections: Record<string, { included: boolean; quantity: number }>;
  onAddOnIncludedChange: (code: string, included: boolean) => void;
  onAddOnQuantityChange: (code: string, quantity: number) => void;
  omnichannelPaidSeats: number;
  omnichannelRosterActiveCount: number;
  leadMagnetActive?: boolean;
  isMidCycleActive?: boolean;
  isTrialPlan?: boolean;
  isExpired?: boolean;
  /** Render inside right sidebar shell (no outer card chrome). */
  embeddedInSidebar?: boolean;
};

export const PlanAddOnsPanel = memo(
  ({
    plan,
    memberCount,
    billingCycle,
    billingTermMonths,
    addOnSelections,
    onAddOnIncludedChange,
    onAddOnQuantityChange,
    omnichannelPaidSeats,
    omnichannelRosterActiveCount,
    leadMagnetActive = false,
    isMidCycleActive = false,
    isTrialPlan = false,
    isExpired = false,
    embeddedInSidebar = false,
  }: PlanAddOnsPanelProps) => {
    const { t } = useTranslation();
    const isYearly = billingCycle === "yearly";
    const cycleKey = isYearly ? "yearly" : "monthly";
    const periodMonths = resolveBillingPeriodMonths(cycleKey, billingTermMonths);
    const termLabel = formatBillingTermLabel(periodMonths, t);

    const selectedTotal = useMemo(
      () =>
        sumSelectedCatalogAddOnsListAmountIdr({
          plan,
          billingCycle: cycleKey,
          annualDiscountPercent: plan.annual_discount_percentage,
          billingTermMonths: periodMonths,
          selections: addOnSelections,
        }),
      [plan, cycleKey, periodMonths, addOnSelections],
    );

    const selectionSummaryRows = useMemo(
      () =>
        summarizeAddOnSelectionsForDisplay(
          plan,
          addOnSelections,
          memberCount,
          cycleKey,
          periodMonths,
        ),
      [plan, addOnSelections, memberCount, cycleKey, periodMonths],
    );

    const body = (
      <>
        <PlanAddOnCatalogRows
          plan={plan}
          memberCount={memberCount}
          billingCycle={billingCycle}
          billingTermMonths={periodMonths}
          addOnSelections={addOnSelections}
          onAddOnIncludedChange={onAddOnIncludedChange}
          onAddOnQuantityChange={onAddOnQuantityChange}
          omnichannelPaidSeats={omnichannelPaidSeats}
          omnichannelRosterActiveCount={omnichannelRosterActiveCount}
          leadMagnetActive={leadMagnetActive}
          isMidCycleActive={isMidCycleActive}
          isTrialPlan={isTrialPlan}
          isExpired={isExpired}
        />

        <div
          className={cn(
            "mt-auto flex-shrink-0 space-y-2 border-t pt-3 text-sm",
            embeddedInSidebar ? "border-border px-4 pb-4" : "border-primary/15",
          )}
        >
          {selectionSummaryRows.length > 0 && (
            <>
              <p className="text-xs font-semibold text-primary">
                {t("subscription.plans.addOnPanel.checkoutBreakdownTitle")}
              </p>
              {selectionSummaryRows.map((row) => (
                <div key={`co-${row.code}`} className="flex justify-between text-muted-foreground">
                  <span className="min-w-0 truncate pr-2">
                    {t("subscription.plans.priceBreakdown.addOnLineTermLabel", {
                      addOns: t("subscription.plans.addOnsSectionTitle"),
                      name: row.name,
                      term: termLabel,
                    })}
                  </span>
                  <span className="shrink-0">{formatIDR(row.amountIdr)}</span>
                </div>
              ))}
              <hr className={embeddedInSidebar ? "border-border" : "border-primary/10"} />
            </>
          )}
          <div className="flex justify-between font-semibold text-foreground">
            <span>
              {periodMonths === 1
                ? t("subscription.plans.addOnPanel.totalMonthly")
                : periodMonths === 12
                  ? t("subscription.plans.addOnPanel.totalYearly")
                  : t("subscription.plans.addOnPanel.totalTermMonths", { months: periodMonths })}
            </span>
            <span>{formatIDR(selectedTotal)}</span>
          </div>
          <p className="text-xs text-muted-foreground">{t("subscription.plans.addOnPanel.checkoutHint")}</p>
        </div>
      </>
    );

    if (embeddedInSidebar) {
      return (
        <div className="flex min-h-0 flex-1 flex-col px-4 pt-4">{body}</div>
      );
    }

    return (
      <Card className="relative flex h-full min-h-0 flex-col border-2 border-primary/25 bg-primary/5 shadow-sm">
        <CardHeader className="flex-shrink-0 space-y-1 pb-3 text-left">
          <CardTitle className="text-lg font-bold">{t("subscription.plans.addOnPanelTitle")}</CardTitle>
          <CardDescription className="text-sm">
            {t("subscription.plans.addOnPanelSubtitle")}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col pt-0">{body}</CardContent>
      </Card>
    );
  },
);

PlanAddOnsPanel.displayName = "PlanAddOnsPanel";
