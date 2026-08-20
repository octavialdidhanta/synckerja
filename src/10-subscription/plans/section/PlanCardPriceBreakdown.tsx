import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  hrPlanTermFormula,
  hrPlanTermHeading,
  resolveBillingPeriodLabel,
  type BillingTermMonths,
} from "@/10-subscription/shared/billingTermUtils";
import {
  addOnLineQuantityCap,
  describeCatalogAddOnLinePricing,
  formatIDR,
  isFlatPerOrganizationAddOn,
} from "@/10-subscription/shared/subscriptionUtils";
import type { SubscriptionPlan, SubscriptionPlanAddOnLink } from "@/10-subscription/types/SubscriptionPlanCatalog";
import { PlanCardAddOnBreakdownLines } from "./PlanCardAddOnBreakdownLines";
import { PriceLineStrikethrough } from "./PriceLineStrikethrough";

type PlanCardPriceBreakdownProps = {
  plan: SubscriptionPlan;
  memberCount: number;
  billingCycle: "monthly" | "yearly";
  periodMonths: BillingTermMonths;
  termLabel: string;
  totalPrice: number;
  hrTermGross: number;
  activeTermDiscount: number | null;
  catalogLinks: SubscriptionPlanAddOnLink[];
  addOnSelections: Record<string, { included: boolean; quantity: number }>;
  selectedCatalogAddonTotal: number;
  addonTotalForHero: number;
  relocateAddOnDetail: boolean;
  hideInlineAddOns: boolean;
  displayHeroTotal: number;
  lastPaidAmount?: number | null;
  lastPaidMemberCount?: number | null;
  isCurrent: boolean;
};

export const PlanCardPriceBreakdown = memo(
  ({
    plan,
    memberCount,
    billingCycle,
    periodMonths,
    termLabel,
    totalPrice,
    hrTermGross,
    activeTermDiscount,
    catalogLinks,
    addOnSelections,
    selectedCatalogAddonTotal,
    addonTotalForHero,
    relocateAddOnDetail,
    hideInlineAddOns,
    displayHeroTotal,
    lastPaidAmount,
    lastPaidMemberCount,
    isCurrent,
  }: PlanCardPriceBreakdownProps) => {
    const { t } = useTranslation();

    const checkoutTotal =
      relocateAddOnDetail || hideInlineAddOns
        ? totalPrice + selectedCatalogAddonTotal
        : displayHeroTotal;

    const checkoutTotalLabel = useMemo(() => {
      if (relocateAddOnDetail && selectedCatalogAddonTotal > 0) {
        return resolveBillingPeriodLabel(
          periodMonths,
          {
            one: "subscription.plans.priceBreakdown.checkoutTotalMonthly",
            twelve: "subscription.plans.priceBreakdown.checkoutTotalYearly",
            term: "subscription.plans.priceBreakdown.checkoutTotalTermMonths",
          },
          t,
        );
      }
      if (relocateAddOnDetail) {
        return resolveBillingPeriodLabel(
          periodMonths,
          {
            one: "subscription.plans.priceBreakdown.totalMonthly",
            twelve: "subscription.plans.priceBreakdown.totalYearly",
            term: "subscription.plans.priceBreakdown.totalTermMonths",
          },
          t,
        );
      }
      if (addonTotalForHero > 0 && !hideInlineAddOns) {
        return resolveBillingPeriodLabel(
          periodMonths,
          {
            one: "subscription.plans.priceBreakdown.totalWithAddonMonthly",
            twelve: "subscription.plans.priceBreakdown.totalWithAddonYearly",
            term: "subscription.plans.priceBreakdown.totalWithAddonTermMonths",
          },
          t,
        );
      }
      return resolveBillingPeriodLabel(
        periodMonths,
        {
          one: "subscription.plans.priceBreakdown.totalMonthly",
          twelve: "subscription.plans.priceBreakdown.totalYearly",
          term: "subscription.plans.priceBreakdown.totalTermMonths",
        },
        t,
      );
    }, [
      relocateAddOnDetail,
      selectedCatalogAddonTotal,
      addonTotalForHero,
      hideInlineAddOns,
      periodMonths,
      t,
    ]);

    const totalGross = useMemo(() => {
      let gross = hrTermGross;
      for (const link of catalogLinks) {
        const code = link.subscription_add_ons.code;
        const sel = addOnSelections[code];
        if (!sel?.included) continue;
        const qtyCap = addOnLineQuantityCap(code, memberCount);
        const billedQty = Math.min(qtyCap, Math.max(1, sel.quantity));
        const isFlatOrg = isFlatPerOrganizationAddOn(link.subscription_add_ons.billing_unit);
        const effectiveQty = isFlatOrg ? 1 : billedQty;
        const pricing = describeCatalogAddOnLinePricing({
          link,
          quantity: effectiveQty,
          plan,
          billingCycle,
          billingTermMonths: periodMonths,
        });
        gross += pricing.grossIdr;
      }
      if (
        !relocateAddOnDetail &&
        catalogLinks.length === 0 &&
        addonTotalForHero > 0
      ) {
        gross += addonTotalForHero;
      }
      return gross;
    }, [
      hrTermGross,
      catalogLinks,
      addOnSelections,
      memberCount,
      plan,
      billingCycle,
      periodMonths,
      relocateAddOnDetail,
      addonTotalForHero,
    ]);

    const totalSavings = Math.max(0, totalGross - checkoutTotal);

    const showAddOnBreakdownLines =
      (relocateAddOnDetail && selectedCatalogAddonTotal > 0) || !relocateAddOnDetail;
    const hasLegacyOmnichannelOnly =
      !relocateAddOnDetail && catalogLinks.length === 0 && addonTotalForHero > 0;

    return (
      <div className="space-y-2.5 text-sm text-muted-foreground">
        {isCurrent && lastPaidAmount != null && lastPaidMemberCount != null && (
          <div className="flex justify-between text-brand-blue">
            <span>
              {t("subscription.plans.lastPaidForMembers", {
                amount: formatIDR(lastPaidAmount),
                count: lastPaidMemberCount,
              })}
            </span>
          </div>
        )}

        <PriceLineStrikethrough
          title={hrPlanTermHeading(periodMonths, t)}
          formula={hrPlanTermFormula(
            periodMonths,
            memberCount,
            formatIDR(plan.base_price_per_member),
            t,
          )}
          grossIdr={hrTermGross}
          netIdr={totalPrice}
          discountPct={activeTermDiscount}
        />

        {showAddOnBreakdownLines && (
          <PlanCardAddOnBreakdownLines
            plan={plan}
            links={catalogLinks}
            addOnSelections={addOnSelections}
            memberCount={memberCount}
            billingCycle={billingCycle}
            periodMonths={periodMonths}
            termLabel={termLabel}
          />
        )}

        {hasLegacyOmnichannelOnly && (
          <PriceLineStrikethrough
            title={t("subscription.plans.priceBreakdown.omnichannelAddonTerm", { term: termLabel })}
            grossIdr={addonTotalForHero}
            netIdr={addonTotalForHero}
          />
        )}

        <hr className="border-border" />

        <div className="flex justify-between font-semibold text-foreground">
          <span className="min-w-0">{checkoutTotalLabel}</span>
          <span className="shrink-0">{formatIDR(checkoutTotal)}</span>
        </div>

        {totalSavings > 0 && (
          <p className="text-xs font-medium text-brand-blue">
            {t("subscription.plans.priceBreakdown.totalSavings", {
              amount: formatIDR(totalSavings),
            })}
          </p>
        )}

        {relocateAddOnDetail && selectedCatalogAddonTotal > 0 && (
          <p className="text-xs text-muted-foreground">
            {t("subscription.plans.priceBreakdown.hrOnlyTerm", {
              term: termLabel,
              amount: formatIDR(totalPrice),
            })}
          </p>
        )}
      </div>
    );
  },
);

PlanCardPriceBreakdown.displayName = "PlanCardPriceBreakdown";
