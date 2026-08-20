import { memo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Slider } from "@/shared/components/ui/slider";
import { Switch } from "@/shared/components/ui/switch";
import { Label } from "@/shared/components/ui/label";
import {
  LEAD_MAGNET_ADD_ON_CODE,
  OMNICHANNEL_ROSTER_ADD_ON_CODE,
  POS_OUTLETS_ADD_ON_CODE,
  addOnLineQuantityCap,
  computeCatalogAddOnLineAmountIdr,
  describeCatalogAddOnLinePricing,
  formatIDR,
  isFlatPerOrganizationAddOn,
  isPerOutletMonthAddOn,
  resolvePlanAddOnUnitMonthly,
  sortPlanAddOnLinks,
} from "@/10-subscription/shared/subscriptionUtils";
import {
  addOnTermFormulaCaption,
  formatBillingTermLabel,
  resolveBillingPeriodMonths,
  type BillingTermMonths,
} from "@/10-subscription/shared/billingTermUtils";
import type { SubscriptionPlan } from "@/10-subscription/types/SubscriptionPlanCatalog";
import { PriceLineStrikethrough } from "./PriceLineStrikethrough";

type PlanAddOnCatalogRowsProps = {
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
  posPaidOutletCount?: number;
  isMidCycleActive?: boolean;
  isTrialPlan?: boolean;
  isExpired?: boolean;
};

function addOnPriceLabelKey(billingUnit: string | null | undefined): string {
  if (isFlatPerOrganizationAddOn(billingUnit)) return "subscription.plans.addOnPricePerOrg";
  if (isPerOutletMonthAddOn(billingUnit)) return "subscription.plans.addOnPricePerOutlet";
  return "subscription.plans.addOnPricePerUnit";
}

function paidAddOnBaseline(
  code: string,
  omnichannelPaidSeats: number,
  leadMagnetActive: boolean,
  posPaidOutletCount: number,
): number {
  if (code === OMNICHANNEL_ROSTER_ADD_ON_CODE) {
    return Math.max(0, Math.round(Number(omnichannelPaidSeats)) || 0);
  }
  if (code === LEAD_MAGNET_ADD_ON_CODE && leadMagnetActive) return 1;
  if (code === POS_OUTLETS_ADD_ON_CODE) {
    return Math.max(0, Math.round(Number(posPaidOutletCount)) || 0);
  }
  return 0;
}

export const PlanAddOnCatalogRows = memo(
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
    posPaidOutletCount = 0,
    isMidCycleActive = false,
    isTrialPlan = false,
    isExpired = false,
  }: PlanAddOnCatalogRowsProps) => {
    const { t } = useTranslation();
    const cycleKey = billingCycle === "yearly" ? "yearly" : "monthly";
    const periodMonths = resolveBillingPeriodMonths(cycleKey, billingTermMonths);
    const catalogLinks = sortPlanAddOnLinks(plan);

    if (catalogLinks.length === 0) return null;

    return (
      <div className="space-y-3">
        {catalogLinks.map((link) => {
          const code = link.subscription_add_ons.code;
          const sel = addOnSelections[code] ?? { included: false, quantity: 1 };
          const qtyCap = addOnLineQuantityCap(code, memberCount);
          const billedQty = Math.min(qtyCap, Math.max(1, sel.quantity));
          const unit = resolvePlanAddOnUnitMonthly(link);
          const isOmni = code === OMNICHANNEL_ROSTER_ADD_ON_CODE;
          const isPos = code === POS_OUTLETS_ADD_ON_CODE;
          const isFlatOrg = isFlatPerOrganizationAddOn(link.subscription_add_ons.billing_unit);
          const effectiveQty = isFlatOrg ? 1 : billedQty;
          const lineAmount = computeCatalogAddOnLineAmountIdr({
            link,
            quantity: effectiveQty,
            plan,
            billingCycle,
            billingTermMonths: periodMonths,
          });
          const pricing = describeCatalogAddOnLinePricing({
            link,
            quantity: effectiveQty,
            plan,
            billingCycle,
            billingTermMonths: periodMonths,
          });
          const termLabel = formatBillingTermLabel(periodMonths, t);

          const baseline = paidAddOnBaseline(code, omnichannelPaidSeats, leadMagnetActive, posPaidOutletCount);
          const toggleOffSchedulable =
            !isExpired &&
            isMidCycleActive &&
            sel.included &&
            baseline > 0 &&
            (isOmni || isPos || code === LEAD_MAGNET_ADD_ON_CODE);
          const sliderMin =
            isMidCycleActive && !isExpired && (isOmni || isPos) && baseline > 0 ? Math.max(1, baseline) : 1;
          const sliderIncreaseOnly =
            !isExpired && isMidCycleActive && (isOmni || isPos) && baseline > 0 && sel.included && !isFlatOrg;

          return (
            <div
              key={code}
              className="space-y-3 rounded-md border border-primary/20 bg-primary/5 p-3 text-left text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <div className="font-semibold leading-snug text-foreground">
                    {link.subscription_add_ons.name}
                  </div>
                  <p className="text-muted-foreground">
                    {t(addOnPriceLabelKey(link.subscription_add_ons.billing_unit), {
                      amount: formatIDR(unit),
                    })}
                  </p>
                  {toggleOffSchedulable && (
                    <p className="text-[11px] text-muted-foreground">
                      {t("subscription.plans.addOnScheduleDowngradeHint")}
                    </p>
                  )}
                  {isExpired && sel.included && (
                    <p className="text-[11px] text-muted-foreground">
                      {t("subscription.plans.addOnExpiredCheckoutHint")}
                    </p>
                  )}
                  {sliderIncreaseOnly && sel.quantity > baseline && (
                    <p className="text-[11px] text-muted-foreground">
                      {t("subscription.plans.addOnMidCycleIncreaseHint")}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Label className="text-[10px] font-normal text-muted-foreground">
                    {t("subscription.plans.addOnIncludeLabel")}
                  </Label>
                  <Switch
                    checked={sel.included}
                    onCheckedChange={(v) => onAddOnIncludedChange(code, v)}
                    disabled={isTrialPlan}
                    className={isTrialPlan ? "pointer-events-none opacity-50" : ""}
                  />
                </div>
              </div>
              {isOmni && (
                <div className="space-y-1 border-t border-primary/10 pt-2 text-[11px] leading-snug">
                  <p className="text-foreground">
                    {t("subscription.plans.omnichannelPaidSeatsEntitled", { count: omnichannelPaidSeats })}
                  </p>
                  <p className="text-muted-foreground">
                    {t("subscription.plans.omnichannelRosterActiveLine", {
                      count: omnichannelRosterActiveCount,
                    })}
                  </p>
                  <Link to="/omnichannel/settings" className="inline-block font-medium text-primary underline">
                    {t("subscription.plans.manageRosterLink")}
                  </Link>
                </div>
              )}
              {!isFlatOrg && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium">
                    {isPos
                      ? t("subscription.plans.addOnQuantityOutletLabel", { count: billedQty, max: qtyCap })
                      : t("subscription.plans.addOnQuantityLabel", { count: billedQty, max: qtyCap })}
                  </Label>
                  <Slider
                    value={[billedQty]}
                    onValueChange={
                      isTrialPlan || !sel.included
                        ? undefined
                        : (value) =>
                            onAddOnQuantityChange(
                              code,
                              Math.min(qtyCap, Math.max(sliderMin, value[0])),
                            )
                    }
                    max={qtyCap}
                    min={sliderMin}
                    step={1}
                    className={isTrialPlan || !sel.included ? "pointer-events-none opacity-50" : "w-full"}
                    disabled={isTrialPlan || !sel.included}
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>{sliderMin}</span>
                    <span>{qtyCap}</span>
                  </div>
                </div>
              )}
              <div className="border-t border-primary/10 pt-2">
                {sel.included ? (
                  <PriceLineStrikethrough
                    size="sm"
                    priceAlignWithTitle
                    title={t("subscription.plans.addOnLineGrandTotalTerm", { term: termLabel })}
                    formula={addOnTermFormulaCaption(
                      periodMonths,
                      effectiveQty,
                      formatIDR(unit),
                      isFlatOrg,
                      t,
                      isPos ? "outlet" : "seat",
                    )}
                    grossIdr={pricing.grossIdr}
                    netIdr={lineAmount}
                    discountPct={pricing.discountPct}
                  />
                ) : (
                  <div className="flex justify-between text-xs font-medium text-muted-foreground">
                    <span>
                      {t("subscription.plans.addOnLineGrandTotalTerm", { term: termLabel })}
                    </span>
                    <span>{formatIDR(0)}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  },
);

PlanAddOnCatalogRows.displayName = "PlanAddOnCatalogRows";
