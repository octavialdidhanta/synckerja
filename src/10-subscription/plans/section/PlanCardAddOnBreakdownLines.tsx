import { memo } from "react";
import { useTranslation } from "react-i18next";
import {
  addOnTermFormulaCaption,
  type BillingTermMonths,
} from "@/10-subscription/shared/billingTermUtils";
import {
  describeCatalogAddOnLinePricing,
  formatIDR,
  isFlatPerOrganizationAddOn,
  resolvePlanAddOnUnitMonthly,
} from "@/10-subscription/shared/subscriptionUtils";
import type { SubscriptionPlan, SubscriptionPlanAddOnLink } from "@/10-subscription/types/SubscriptionPlanCatalog";
import { PriceLineStrikethrough } from "./PriceLineStrikethrough";

type PlanCardAddOnBreakdownLinesProps = {
  plan: SubscriptionPlan;
  links: SubscriptionPlanAddOnLink[];
  addOnSelections: Record<string, { included: boolean; quantity: number }>;
  memberCount: number;
  billingCycle: "monthly" | "yearly";
  periodMonths: BillingTermMonths;
  termLabel: string;
};

export const PlanCardAddOnBreakdownLines = memo(
  ({
    plan,
    links,
    addOnSelections,
    memberCount,
    billingCycle,
    periodMonths,
    termLabel,
  }: PlanCardAddOnBreakdownLinesProps) => {
    const { t } = useTranslation();

    return (
      <>
        {links.map((link) => {
          const code = link.subscription_add_ons.code;
          const sel = addOnSelections[code] ?? { included: false, quantity: 1 };
          if (!sel.included) return null;

          const seatCap = Math.max(1, memberCount);
          const billedQty = Math.min(seatCap, Math.max(1, sel.quantity));
          const isFlatOrg = isFlatPerOrganizationAddOn(link.subscription_add_ons.billing_unit);
          const effectiveQty = isFlatOrg ? 1 : billedQty;
          const unit = resolvePlanAddOnUnitMonthly(link);
          const pricing = describeCatalogAddOnLinePricing({
            link,
            quantity: effectiveQty,
            plan,
            billingCycle,
            billingTermMonths: periodMonths,
          });

          return (
            <PriceLineStrikethrough
              key={`addon-bd-${code}`}
              title={t("subscription.plans.priceBreakdown.addOnLineTermLabel", {
                addOns: t("subscription.plans.addOnsSectionTitle"),
                name: link.subscription_add_ons.name,
                term: termLabel,
              })}
              formula={addOnTermFormulaCaption(
                periodMonths,
                effectiveQty,
                formatIDR(unit),
                isFlatOrg,
                t,
              )}
              grossIdr={pricing.grossIdr}
              netIdr={pricing.netIdr}
              discountPct={pricing.discountPct}
            />
          );
        })}
      </>
    );
  },
);

PlanCardAddOnBreakdownLines.displayName = "PlanCardAddOnBreakdownLines";
