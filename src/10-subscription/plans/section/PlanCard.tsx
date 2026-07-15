import { memo, useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Slider } from "@/shared/components/ui/slider";
import { Switch } from "@/shared/components/ui/switch";
import { Label } from "@/shared/components/ui/label";
import { Check, Loader2, X, type LucideIcon } from "lucide-react";
import {
  OMNICHANNEL_ROSTER_ADD_ON_CODE,
  catalogAddOnListAmountForMidtransSplit,
  computePlanAddOnLineYearlyTotalIdr,
  formatIDR,
  resolvePlanAddOnUnitMonthly,
  sortPlanAddOnLinks,
  sumSelectedCatalogAddOnsListAmountIdr,
} from "@/10-subscription/shared/subscriptionUtils";
import { buildPlanModuleDisplayRows, isPlanModuleFeatureLine } from "@/10-subscription/shared/planModuleDisplay";
import { filterPlanFeaturesForDisplay } from "@/0-onboarding/utils/subscriptionPlanUtils";
import type { SubscriptionPlan } from "@/10-subscription/types/SubscriptionPlanCatalog";
import { createDefaultSalesModuleAccess } from "@/shared/auth/module-access/moduleCatalog";
import { cn } from "@/shared/lib/utils";

interface PlanCardProps {
  plan: SubscriptionPlan;
  memberCount: number;
  billingCycle: "monthly" | "yearly";
  totalPrice: number;
  monthlyPrice: number;
  maxEmployees: number;
  isTrialPlan: boolean;
  isCurrent: boolean;
  isPopular: boolean;
  canChange: boolean;
  buttonText: string;
  hasBillingCycleChange: boolean;
  IconComponent: LucideIcon;
  currentMemberCount: number;
  currentEmployeeCount: number;
  isRenewEligible: boolean;
  subscriptionStatus?: {
    is_trial?: boolean;
    days_until_expiry?: number;
    billing_cycle?: string;
  };
  lastPaidAmount?: number | null;
  lastPaidMemberCount?: number | null;
  /** Merged selections for `plan.plan_add_ons` rows (by add-on `code`). */
  addOnSelections: Record<string, { included: boolean; quantity: number }>;
  onAddOnIncludedChange: (code: string, included: boolean) => void;
  onAddOnQuantityChange: (code: string, quantity: number) => void;
  /** For omnichannel row copy + legacy headline when no junction rows. */
  omnichannelPaidSeats: number;
  omnichannelRosterActiveCount: number;
  onMemberCountChange: (planId: string, count: number) => void;
  onBillingCycleChange: (planId: string, isYearly: boolean) => void;
  onUpgrade: (
    plan: SubscriptionPlan,
    memberCount: number,
    billingCycle: "monthly" | "yearly",
    addOnSelections: Record<string, { included: boolean; quantity: number }>,
  ) => void;
  onRenew?: (
    plan: SubscriptionPlan,
    memberCount: number,
    billingCycle: "monthly" | "yearly",
    addOnSelections: Record<string, { included: boolean; quantity: number }>,
  ) => void;
  /** True while prorate fetch or Midtrans (renew) is in progress for this card's primary action. */
  isPrimaryActionLoading?: boolean;
}

export const PlanCard = memo(
  ({
    plan,
    memberCount,
    billingCycle,
    totalPrice,
    monthlyPrice,
    maxEmployees,
    isTrialPlan,
    isCurrent,
    isPopular,
    canChange,
    buttonText,
    hasBillingCycleChange,
    IconComponent,
    currentMemberCount,
    currentEmployeeCount,
    isRenewEligible,
    subscriptionStatus,
    lastPaidAmount,
    lastPaidMemberCount,
    addOnSelections,
    onAddOnIncludedChange,
    onAddOnQuantityChange,
    omnichannelPaidSeats,
    omnichannelRosterActiveCount,
    onMemberCountChange,
    onBillingCycleChange,
    onUpgrade,
    onRenew,
    isPrimaryActionLoading = false,
  }: PlanCardProps) => {
    const { t } = useTranslation();
    const {
      coreFeaturesBeforeModules,
      dashboardFeature,
      featureRowsAfterAddOnsSection,
      showAddOnsHeading,
      planModuleRows,
    } = useMemo(() => {
      const filtered = filterPlanFeaturesForDisplay(plan.features ?? [], plan).filter(
        (feature) => !isPlanModuleFeatureLine(feature),
      );
      const idx = filtered.findIndex((f) => /dedicated\s+support/i.test(String(f).trim()));
      const beforeAddOns = idx < 0 ? filtered : filtered.slice(0, idx + 1);
      const afterAddOns = idx < 0 ? ([] as string[]) : filtered.slice(idx + 1);
      const dashboardIdx = beforeAddOns.findIndex((f) => /^Dashboard$/i.test(f.trim()));
      const dashboardFeature = dashboardIdx >= 0 ? beforeAddOns[dashboardIdx] : null;
      const coreFeaturesBeforeModules =
        dashboardIdx >= 0 ? beforeAddOns.filter((_, i) => i !== dashboardIdx) : beforeAddOns;
      const moduleRows = buildPlanModuleDisplayRows(
        plan.plan_module_access ?? createDefaultSalesModuleAccess(),
      );
      return {
        coreFeaturesBeforeModules,
        dashboardFeature,
        featureRowsAfterAddOnsSection: afterAddOns,
        showAddOnsHeading: idx >= 0,
        planModuleRows: moduleRows,
      };
    }, [plan.features, plan.base_price_per_member, plan.plan_module_access]);

    const catalogLinks = useMemo(() => sortPlanAddOnLinks(plan), [plan]);
    const showAddOnsBlockHeading = showAddOnsHeading || catalogLinks.length > 0;

    const isYearly = billingCycle === "yearly";
    const cycleKey = isYearly ? "yearly" : "monthly";

    const selectedCatalogAddonTotal = useMemo(
      () =>
        sumSelectedCatalogAddOnsListAmountIdr({
          plan,
          billingCycle: cycleKey,
          annualDiscountPercent: plan.annual_discount_percentage,
          selections: addOnSelections,
        }),
      [plan, cycleKey, addOnSelections],
    );

    const legacyFallbackAddonTotal = useMemo(
      () =>
        catalogAddOnListAmountForMidtransSplit({
          plan,
          billingCycle: cycleKey,
          annualDiscountPercent: plan.annual_discount_percentage,
          selections: {},
          legacyOmnichannelPaidSeatCount: omnichannelPaidSeats,
        }),
      [plan, cycleKey, omnichannelPaidSeats],
    );

    const addonTotalForHero = catalogLinks.length > 0 ? selectedCatalogAddonTotal : legacyFallbackAddonTotal;
    const displayHeroTotal = totalPrice + addonTotalForHero;

    const isComingSoon =
      plan.description?.toLowerCase().includes("coming soon") ||
      plan.description?.toLowerCase().includes("comming soon");
    const shouldRenew =
      isRenewEligible && isCurrent && memberCount === currentMemberCount && !hasBillingCycleChange;
    const handlePrimaryAction = () => {
      if (shouldRenew && onRenew) {
        onRenew(plan, memberCount, billingCycle, addOnSelections);
      } else {
        onUpgrade(plan, memberCount, billingCycle, addOnSelections);
      }
    };

    /** Ringkasan add-on aktif untuk kartu "paket saat ini" (nama add-on + kuota / roster omnichannel). */
    const currentPlanAddOnSummaryItems = useMemo((): ReactNode[] => {
      if (!isCurrent) return [];
      const parts: ReactNode[] = [];
      for (const link of catalogLinks) {
        const code = link.subscription_add_ons.code;
        const sel = addOnSelections[code];
        const isOmni = code === OMNICHANNEL_ROSTER_ADD_ON_CODE;
        const visible = isOmni
          ? omnichannelPaidSeats > 0 || Boolean(sel?.included)
          : Boolean(sel?.included);
        if (!visible) continue;
        const name = link.subscription_add_ons.name;
        if (isOmni) {
          parts.push(
            <div key={code} className="text-xs text-muted-foreground">
              <div className="font-medium text-foreground">{name}</div>
              <div className="mt-0.5">
                {t("subscription.plans.currentPlan.omnichannelSeatDetail", {
                  paid: omnichannelPaidSeats,
                  roster: omnichannelRosterActiveCount,
                })}
              </div>
            </div>,
          );
        } else {
          parts.push(
            <div key={code} className="text-xs text-muted-foreground">
              <div className="font-medium text-foreground">{name}</div>
              <div className="mt-0.5">
                {t("subscription.plans.currentPlan.addOnQuantityDetail", {
                  count: Math.max(1, sel?.quantity ?? 1),
                })}
              </div>
            </div>,
          );
        }
      }
      if (catalogLinks.length === 0 && omnichannelPaidSeats > 0) {
        parts.push(
          <div key="legacy-omnichannel" className="text-xs text-muted-foreground">
            <div className="font-medium text-foreground">{t("subscription.plans.omnichannelAddonTitle")}</div>
            <div className="mt-0.5">
              {t("subscription.plans.currentPlan.omnichannelSeatDetail", {
                paid: omnichannelPaidSeats,
                roster: omnichannelRosterActiveCount,
              })}
            </div>
          </div>,
        );
      }
      return parts;
    }, [
      isCurrent,
      catalogLinks,
      addOnSelections,
      omnichannelPaidSeats,
      omnichannelRosterActiveCount,
      t,
    ]);

    return (
      <Card
        className={`relative flex h-full flex-col transition-all duration-300 hover:shadow-xl ${
          isCurrent
            ? "border-2 border-brand-blue bg-brand-blue/5 shadow-lg dark:bg-brand-blue/10"
            : isPopular
              ? "border-2 border-brand-blue shadow-lg"
              : "border border-border"
        }`}
      >
        {isCurrent && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 transform">
            <Badge className="bg-brand-blue px-4 py-1 text-brand-white hover:bg-brand-blue">
              {subscriptionStatus?.is_trial
                ? t("subscription.plans.badge.trial", {
                    days: subscriptionStatus.days_until_expiry || 0,
                  })
                : t("subscription.plans.badge.current")}
            </Badge>
          </div>
        )}
        {!isCurrent && isPopular && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 transform">
            <Badge className="bg-brand-blue px-4 py-1 text-brand-white hover:bg-brand-blue">
              {t("subscription.plans.badge.popular")}
            </Badge>
          </div>
        )}

        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center">
            <div
              className={`rounded-full p-3 ${
                isCurrent
                  ? "bg-brand-blue/15 text-brand-blue dark:bg-brand-blue/20"
                  : isPopular
                    ? "bg-brand-blue/15 text-brand-blue dark:bg-brand-blue/20"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              <IconComponent className="h-6 w-6" />
            </div>
          </div>

          <div>
            <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
            <CardDescription className="mt-2 text-base">{plan.description}</CardDescription>
          </div>

          <div className="space-y-2">
            <div className="text-4xl font-bold text-foreground">{formatIDR(displayHeroTotal)}</div>
            <div className="text-sm text-muted-foreground">
              {isYearly
                ? t("subscription.plans.pricing.perYear", { count: memberCount })
                : t("subscription.plans.pricing.perMonth", { count: memberCount })}
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex h-full flex-col space-y-6">
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              {t("subscription.plans.memberCount.label", { count: memberCount })}
              {isTrialPlan && t("subscription.plans.memberCount.maxLabel", { max: maxEmployees })}
            </Label>
            <Slider
              value={[memberCount]}
              onValueChange={isTrialPlan ? undefined : (value) => onMemberCountChange(plan.id, value[0])}
              max={maxEmployees}
              min={1}
              step={1}
              className={isTrialPlan ? "pointer-events-none opacity-50" : "w-full"}
              disabled={isTrialPlan}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t("subscription.plans.memberCount.min")}</span>
              <span>{t("subscription.plans.memberCount.maxDisplay", { max: maxEmployees })}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">{t("subscription.plans.billingCycle.yearly")}</Label>
            <Switch
              checked={billingCycle === "yearly"}
              onCheckedChange={isTrialPlan ? undefined : (checked) => onBillingCycleChange(plan.id, checked)}
              disabled={isTrialPlan}
              className={isTrialPlan ? "pointer-events-none opacity-50" : ""}
            />
          </div>

          <div className="space-y-3 text-left">
            <h4 className="font-medium text-foreground">{t("subscription.plans.features.title")}</h4>
            <ul className="space-y-2">
              {dashboardFeature && (
                <li key="feat-dashboard" className="flex items-start space-x-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-blue" />
                  <span className="text-sm text-muted-foreground">{dashboardFeature}</span>
                </li>
              )}
              {coreFeaturesBeforeModules.map((feature, index) => (
                <li key={`feat-core-${index}`} className="flex items-start space-x-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-blue" />
                  <span className="text-sm text-muted-foreground">{feature}</span>
                </li>
              ))}
              {planModuleRows.map((moduleRow) => (
                <li key={`plan-mod-${moduleRow.key}`} className="flex items-start space-x-2">
                  {moduleRow.enabled ? (
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-blue" />
                  ) : (
                    <X className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
                  )}
                  <span
                    className={cn(
                      "text-sm",
                      moduleRow.enabled ? "text-muted-foreground" : "text-muted-foreground/80",
                    )}
                  >
                    {`Modul ${t(moduleRow.labelKey)}`}
                  </span>
                </li>
              ))}
            </ul>
            {featureRowsAfterAddOnsSection.length > 0 && (
              <ul className="space-y-2">
                {featureRowsAfterAddOnsSection.map((feature, index) => (
                  <li key={`feat-after-${index}`} className="flex items-start space-x-2">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-blue" />
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            )}
            {showAddOnsBlockHeading && (
              <h4 className="font-medium text-foreground">{t("subscription.plans.addOnsSectionTitle")}</h4>
            )}
            {catalogLinks.length > 0 && (
              <div className="space-y-3">
                {catalogLinks.map((link) => {
                  const code = link.subscription_add_ons.code;
                  const sel = addOnSelections[code] ?? { included: false, quantity: 1 };
                  const seatCap = Math.max(1, memberCount);
                  const billedQty = Math.min(seatCap, Math.max(1, sel.quantity));
                  const unit = resolvePlanAddOnUnitMonthly(link);
                  const lineAmount = isYearly
                    ? computePlanAddOnLineYearlyTotalIdr(
                        billedQty,
                        unit,
                        link.subscription_add_ons.follows_plan_annual_discount !== false,
                        plan.annual_discount_percentage,
                      )
                    : billedQty * unit;
                  const isOmni = code === OMNICHANNEL_ROSTER_ADD_ON_CODE;
                  return (
                    <div
                      key={code}
                      className="rounded-md border border-primary/20 bg-primary/5 p-3 text-left text-xs space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <div className="font-semibold text-foreground leading-snug">
                            {link.subscription_add_ons.name}
                          </div>
                          <p className="text-muted-foreground">
                            {t("subscription.plans.addOnPricePerUnit", { amount: formatIDR(unit) })}
                          </p>
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
                            {t("subscription.plans.omnichannelRosterActiveLine", { count: omnichannelRosterActiveCount })}
                          </p>
                          <Link to="/omnichannel/settings" className="inline-block font-medium text-primary underline">
                            {t("subscription.plans.manageRosterLink")}
                          </Link>
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">
                          {t("subscription.plans.addOnQuantityLabel", { count: billedQty, max: seatCap })}
                        </Label>
                        <Slider
                          value={[billedQty]}
                          onValueChange={
                            isTrialPlan || !sel.included
                              ? undefined
                              : (value) =>
                                  onAddOnQuantityChange(code, Math.min(seatCap, Math.max(1, value[0])))
                          }
                          max={seatCap}
                          min={1}
                          step={1}
                          className={isTrialPlan || !sel.included ? "pointer-events-none opacity-50" : "w-full"}
                          disabled={isTrialPlan || !sel.included}
                        />
                        <div className="flex justify-between text-[11px] text-muted-foreground">
                          <span>1</span>
                          <span>{seatCap}</span>
                        </div>
                      </div>
                      <div className="flex justify-between border-t border-primary/10 pt-2 font-medium text-foreground">
                        <span>{t("subscription.plans.addOnLineSubtotal")}</span>
                        <span>{formatIDR(sel.included ? lineAmount : 0)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-auto">
            <Button
              className={cn(
                "w-full py-3 text-base font-medium touch-manipulation transition-[transform,filter,box-shadow] duration-150 ease-out",
                "active:scale-[0.97] active:brightness-[0.92] active:shadow-inner",
                "disabled:active:scale-100 disabled:active:brightness-100",
              )}
              variant={isCurrent && memberCount === currentMemberCount ? "default" : "default"}
              onClick={handlePrimaryAction}
              disabled={
                isComingSoon ||
                !canChange ||
                (isCurrent && memberCount === currentMemberCount && !hasBillingCycleChange && !isRenewEligible) ||
                isPrimaryActionLoading
              }
              aria-busy={isPrimaryActionLoading}
            >
              {isPrimaryActionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  <span>{isComingSoon ? t("subscription.plans.button.comingSoon") : buttonText}</span>
                </>
              ) : isComingSoon ? (
                t("subscription.plans.button.comingSoon")
              ) : (
                buttonText
              )}
            </Button>
            {isCurrent && (
              <div className="mt-2 text-center text-xs font-medium text-brand-blue">
                {t("subscription.plans.currentPlan.label", {
                  memberCount: currentMemberCount,
                  employeeCount: currentEmployeeCount,
                })}
              </div>
            )}
            {isCurrent && (
              <div className="mt-3 rounded-md border border-primary/15 bg-primary/5 px-3 py-2 text-left">
                <p className="text-xs font-semibold text-primary">
                  {t("subscription.plans.currentPlan.addOnSectionTitle")}
                </p>
                {currentPlanAddOnSummaryItems.length > 0 ? (
                  <div className="mt-2 space-y-2">{currentPlanAddOnSummaryItems}</div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("subscription.plans.currentPlan.noPaidAddOns")}
                  </p>
                )}
              </div>
            )}
            {!canChange && isCurrent && memberCount < currentMemberCount && (
              <p className="mt-2 text-center text-xs text-brand-red">
                {t("subscription.plans.downgrade.error", { count: currentEmployeeCount })}
              </p>
            )}
          </div>

          {isYearly && plan.annual_discount_percentage != null && (
            <div className="text-center text-sm font-medium text-brand-blue">
              {t("subscription.plans.savings", { percentage: plan.annual_discount_percentage })}
            </div>
          )}

          <div className="space-y-2 text-sm text-muted-foreground">
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
            <div className="flex justify-between">
              <span>{t("subscription.plans.priceBreakdown.perMember")}</span>
              <span>{formatIDR(plan.base_price_per_member)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("subscription.plans.priceBreakdown.monthlySubtotal")}</span>
              <span>{formatIDR(monthlyPrice)}</span>
            </div>
            {isYearly && plan.annual_discount_percentage != null && (
              <div className="flex justify-between text-brand-red">
                <span>
                  {t("subscription.plans.priceBreakdown.yearlyDiscount", {
                    percentage: plan.annual_discount_percentage,
                  })}
                </span>
                <span>-{formatIDR(monthlyPrice * 12 * (plan.annual_discount_percentage / 100))}</span>
              </div>
            )}
            {catalogLinks.map((link) => {
              const code = link.subscription_add_ons.code;
              const sel = addOnSelections[code] ?? { included: false, quantity: 1 };
              if (!sel.included) return null;
              const seatCap = Math.max(1, memberCount);
              const billedQty = Math.min(seatCap, Math.max(1, sel.quantity));
              const unit = resolvePlanAddOnUnitMonthly(link);
              const amount = isYearly
                ? computePlanAddOnLineYearlyTotalIdr(
                    billedQty,
                    unit,
                    link.subscription_add_ons.follows_plan_annual_discount !== false,
                    plan.annual_discount_percentage,
                  )
                : billedQty * unit;
              return (
                <div key={`bd-${code}`} className="flex justify-between text-muted-foreground">
                  <span className="min-w-0 truncate pr-2">
                    {t("subscription.plans.priceBreakdown.addOnLineLabel", {
                      addOns: t("subscription.plans.addOnsSectionTitle"),
                      name: link.subscription_add_ons.name,
                    })}
                  </span>
                  <span className="shrink-0">{formatIDR(amount)}</span>
                </div>
              );
            })}
            {catalogLinks.length === 0 && addonTotalForHero > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>{t("subscription.plans.priceBreakdown.omnichannelAddonMonthly")}</span>
                <span>{formatIDR(addonTotalForHero)}</span>
              </div>
            )}
            <hr className="border-border" />
            <div className="flex justify-between font-medium text-foreground">
              <span>
                {addonTotalForHero > 0
                  ? isYearly
                    ? t("subscription.plans.priceBreakdown.totalWithAddonYearly")
                    : t("subscription.plans.priceBreakdown.totalWithAddonMonthly")
                  : isYearly
                    ? t("subscription.plans.priceBreakdown.totalYearly")
                    : t("subscription.plans.priceBreakdown.totalMonthly")}
              </span>
              <span>{formatIDR(displayHeroTotal)}</span>
            </div>
          </div>

          {plan.demo_required && (
            <p className="text-center text-xs text-muted-foreground">{t("subscription.plans.demoRequired")}</p>
          )}
        </CardContent>
      </Card>
    );
  },
);

PlanCard.displayName = "PlanCard";
