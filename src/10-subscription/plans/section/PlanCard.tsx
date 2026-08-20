import { memo, useMemo, type ReactNode } from "react";
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
  POS_OUTLETS_ADD_ON_CODE,
  catalogAddOnListAmountForMidtransSplit,
  formatIDR,
  buildEnterpriseSalesWhatsAppUrl,
  sortPlanAddOnLinks,
  sumSelectedCatalogAddOnsListAmountIdr,
} from "@/10-subscription/shared/subscriptionUtils";
import { buildPlanModuleDisplayRows, isPlanModuleFeatureLine } from "@/10-subscription/shared/planModuleDisplay";
import {
  filterPlanModuleRowsForCard,
  formatPlanModuleLine,
  planHasCustomModulesFeature,
  translatePlanFeatureBullet,
} from "@/10-subscription/shared/planFeatureDisplayI18n";
import { resolvePlanCustomerSupportLabelKey } from "@/10-subscription/shared/planCustomerSupport";
import { filterPlanFeaturesForDisplay, resolvePaidPlanSliderMin, shouldShowDynamicMemberAllowed } from "@/0-onboarding/utils/subscriptionPlanUtils";
import type { SubscriptionPlan } from "@/10-subscription/types/SubscriptionPlanCatalog";
import { createDefaultSalesModuleAccess } from "@/shared/auth/module-access/moduleCatalog";
import { cn } from "@/shared/lib/utils";
import { PlanAddOnCatalogRows } from "./PlanAddOnCatalogRows";
import { PlanCardPriceBreakdown } from "./PlanCardPriceBreakdown";
import { BillingTermSelector } from "./BillingTermSelector";
import {
  formatBillingTermLabel,
  resolveTermDiscount,
  resolveBillingPeriodMonths,
  usesBillingTermSelector,
  type BillingTermMonths,
} from "@/10-subscription/shared/billingTermUtils";

interface PlanCardProps {
  plan: SubscriptionPlan;
  memberCount: number;
  billingCycle: "monthly" | "yearly";
  /** Billing term in months (Scale Up / Enterprise). */
  billingTermMonths?: BillingTermMonths;
  totalPrice: number;
  monthlyPrice: number;
  maxEmployees: number;
  /** Slider minimum — paid floor or enterprise min (Scale Up max + 1). */
  memberSliderMin?: number;
  isTrialPlan: boolean;
  isEnterprisePlan?: boolean;
  isCurrent: boolean;
  isPopular: boolean;
  canChange: boolean;
  buttonText: string;
  hasBillingCycleChange: boolean;
  hasCheckoutableAddOnChanges?: boolean;
  hasSchedulableDowngrade?: boolean;
  /** Block member/billing downgrade while subscription period is still active. */
  isMidCycleActive?: boolean;
  /** Minimum member count for paid plans (freeMax + 1). */
  paidMemberFloor?: number;
  IconComponent: LucideIcon;
  currentMemberCount: number;
  currentEmployeeCount: number;
  isRenewEligible: boolean;
  subscriptionStatus?: {
    is_trial?: boolean;
    is_expired?: boolean;
    days_until_expiry?: number;
    billing_cycle?: string;
    billing_term_months?: number;
    lead_magnet_active?: boolean;
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
  posPaidOutletCount?: number;
  onMemberCountChange: (planId: string, count: number) => void;
  onBillingCycleChange: (planId: string, isYearly: boolean) => void;
  onBillingTermChange?: (planId: string, months: BillingTermMonths) => void;
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
  /** Hide interactive add-on rows (managed in adjacent PlanAddOnsPanel). */
  hideInlineAddOns?: boolean;
  /** Compact add-on summary on current plan card when add-ons are in side panel. */
  showCompactAddOnSummary?: boolean;
  /** Add-on detail/pricing shown only in adjacent panel (HR-only on card). */
  relocateAddOnDetail?: boolean;
}

export const PlanCard = memo(
  ({
    plan,
    memberCount,
    billingCycle,
    billingTermMonths = 1,
    totalPrice,
    monthlyPrice,
    maxEmployees,
    memberSliderMin: memberSliderMinProp,
    isTrialPlan,
    isEnterprisePlan = false,
    isCurrent,
    isPopular,
    canChange,
    buttonText,
    hasBillingCycleChange,
    hasCheckoutableAddOnChanges = false,
    hasSchedulableDowngrade = false,
    isMidCycleActive = false,
    paidMemberFloor = 2,
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
    posPaidOutletCount = 0,
    onMemberCountChange,
    onBillingCycleChange,
    onBillingTermChange,
    onUpgrade,
    onRenew,
    isPrimaryActionLoading = false,
    hideInlineAddOns = false,
    showCompactAddOnSummary = false,
    relocateAddOnDetail = false,
  }: PlanCardProps) => {
    const { t } = useTranslation();
    const {
      coreFeaturesBeforeModules,
      dashboardFeature,
      featureRowsAfterAddOnsSection,
      showAddOnsHeading,
      planModuleRows,
    } = useMemo(() => {
      const moduleRows = buildPlanModuleDisplayRows(
        plan.plan_module_access ?? createDefaultSalesModuleAccess(),
      );

      if (isEnterprisePlan) {
        return {
          coreFeaturesBeforeModules: [] as string[],
          dashboardFeature: t("subscription.plans.features.dashboard"),
          featureRowsAfterAddOnsSection: [] as string[],
          showAddOnsHeading: false,
          planModuleRows: filterPlanModuleRowsForCard(moduleRows, { excludeAddOnModules: true }),
        };
      }

      const filtered = filterPlanFeaturesForDisplay(plan.features ?? [], plan).filter(
        (feature) => !isPlanModuleFeatureLine(feature),
      );
      const idx = filtered.findIndex((f) => /dedicated\s+support/i.test(String(f).trim()));
      const beforeAddOns = idx < 0 ? filtered : filtered.slice(0, idx + 1);
      const afterAddOns = idx < 0 ? ([] as string[]) : filtered.slice(idx + 1);
      const dashboardIdx = beforeAddOns.findIndex((f) => /^Dashboard$/i.test(f.trim()));
      const rawDashboard = dashboardIdx >= 0 ? beforeAddOns[dashboardIdx] : null;
      const rawCore =
        dashboardIdx >= 0 ? beforeAddOns.filter((_, i) => i !== dashboardIdx) : beforeAddOns;
      return {
        coreFeaturesBeforeModules: rawCore.map((f) => translatePlanFeatureBullet(f, t)),
        dashboardFeature: rawDashboard ? translatePlanFeatureBullet(rawDashboard, t) : null,
        featureRowsAfterAddOnsSection: afterAddOns.map((f) => translatePlanFeatureBullet(f, t)),
        showAddOnsHeading: idx >= 0,
        planModuleRows: filterPlanModuleRowsForCard(moduleRows, { excludeAddOnModules: true }),
      };
    }, [plan.features, plan.base_price_per_member, plan.plan_module_access, isEnterprisePlan, t]);

    const customModulesEnabled = planHasCustomModulesFeature(plan);
    const customerSupportLabelKey = resolvePlanCustomerSupportLabelKey(plan);

    const catalogLinks = useMemo(() => sortPlanAddOnLinks(plan), [plan]);
    const showDynamicMemberAllowed =
      isEnterprisePlan || shouldShowDynamicMemberAllowed(plan);
    const showAddOnsBlockHeading =
      !hideInlineAddOns && !isEnterprisePlan && (showAddOnsHeading || catalogLinks.length > 0);

    const usesTermSelector = usesBillingTermSelector(plan);
    const isYearly = billingCycle === "yearly";
    const cycleKey = isYearly ? "yearly" : "monthly";
    const periodMonths = resolveBillingPeriodMonths(cycleKey, billingTermMonths);
    const activeTermDiscount = resolveTermDiscount(plan, periodMonths);
    const hrTermGross = monthlyPrice * periodMonths;
    const hrTermDiscountAmount =
      activeTermDiscount != null && activeTermDiscount > 0
        ? hrTermGross * (activeTermDiscount / 100)
        : 0;
    const termLabel = formatBillingTermLabel(periodMonths, t);

    const selectedCatalogAddonTotal = useMemo(
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

    const legacyFallbackAddonTotal = useMemo(
      () =>
        catalogAddOnListAmountForMidtransSplit({
          plan,
          billingCycle: cycleKey,
          annualDiscountPercent: plan.annual_discount_percentage,
          billingTermMonths: periodMonths,
          selections: {},
          legacyOmnichannelPaidSeatCount: omnichannelPaidSeats,
        }),
      [plan, cycleKey, periodMonths, omnichannelPaidSeats],
    );

    const addonTotalForHero = catalogLinks.length > 0 ? selectedCatalogAddonTotal : legacyFallbackAddonTotal;
    const displayHeroTotal = hideInlineAddOns ? totalPrice : totalPrice + addonTotalForHero;

    const isComingSoon =
      plan.description?.toLowerCase().includes("coming soon") ||
      plan.description?.toLowerCase().includes("comming soon");
    const currentBillingCycle = subscriptionStatus?.billing_cycle || "monthly";
    const currentOrgTermMonths = (subscriptionStatus?.billing_term_months ??
      (currentBillingCycle === "yearly" ? 12 : 1)) as BillingTermMonths;
    const memberSliderMin = isEnterprisePlan
      ? (memberSliderMinProp ?? 51)
      : isTrialPlan
        ? 1
        : resolvePaidPlanSliderMin({
            paidMemberFloor,
            isCurrentPlan: isCurrent,
            isMidCycleActive,
            subscribedMemberCount: currentMemberCount,
          });
    const billingDowngradeBlocked =
      isCurrent &&
      isMidCycleActive &&
      (usesTermSelector
        ? billingTermMonths < currentOrgTermMonths
        : currentBillingCycle === "yearly" && billingCycle === "monthly");
    const shouldRenew =
      isRenewEligible && isCurrent && memberCount === currentMemberCount && !hasBillingCycleChange;
    const handlePrimaryAction = () => {
      if (isEnterprisePlan) {
        const message = t("subscription.plans.enterprise.whatsappMessage", {
          planName: plan.name,
          memberCount,
          billingTerm: formatBillingTermLabel(billingTermMonths, t),
        });
        window.open(buildEnterpriseSalesWhatsAppUrl(message), "_blank", "noopener,noreferrer");
        return;
      }
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
        const isPos = code === POS_OUTLETS_ADD_ON_CODE;
        const visible = isOmni
          ? omnichannelPaidSeats > 0 || Boolean(sel?.included)
          : isPos
            ? posPaidOutletCount > 0 || Boolean(sel?.included)
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
        } else if (isPos) {
          parts.push(
            <div key={code} className="text-xs text-muted-foreground">
              <div className="font-medium text-foreground">{name}</div>
              <div className="mt-0.5">
                {t("subscription.plans.currentPlan.posOutletDetail", {
                  count: Math.max(posPaidOutletCount, sel?.quantity ?? 0),
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
      posPaidOutletCount,
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
              {subscriptionStatus?.is_expired ||
              (subscriptionStatus?.days_until_expiry ?? 0) <= 0
                ? t("subscription.plans.badge.expired")
                : subscriptionStatus?.is_trial
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
        {!isCurrent && isEnterprisePlan && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 transform">
            <Badge className="bg-muted-foreground px-4 py-1 text-brand-white hover:bg-muted-foreground">
              {t("subscription.plans.badge.enterprise")}
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
            <CardDescription className="mt-2 text-center text-base">
              {isEnterprisePlan ? t("subscription.plans.enterprise.description") : plan.description}
            </CardDescription>
          </div>

          <div className="space-y-2">
            {isEnterprisePlan ? (
              <>
                <div className="text-4xl font-bold text-foreground">
                  {t("subscription.plans.enterprise.pricingLabel")}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("subscription.plans.enterprise.memberCount", { count: memberCount })}
                </div>
              </>
            ) : (
              <>
                <div className="text-4xl font-bold text-foreground">{formatIDR(displayHeroTotal)}</div>
                <div className="text-sm text-muted-foreground">
                  {usesTermSelector && billingTermMonths !== 12
                    ? t("subscription.plans.pricing.perTermMonths", {
                        months: billingTermMonths,
                        count: memberCount,
                      })
                    : isYearly
                      ? t("subscription.plans.pricing.perYear", { count: memberCount })
                      : t("subscription.plans.pricing.perMonth", { count: memberCount })}
                </div>
              </>
            )}
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
              onValueChange={
                isTrialPlan
                  ? undefined
                  : (value) =>
                      onMemberCountChange(
                        plan.id,
                        Math.max(memberSliderMin, Math.min(maxEmployees, value[0])),
                      )
              }
              max={maxEmployees}
              min={memberSliderMin}
              step={1}
              className={isTrialPlan ? "pointer-events-none opacity-50" : "w-full"}
              disabled={isTrialPlan}
            />
            {isTrialPlan ? (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("subscription.plans.memberCount.sliderMin", { count: memberSliderMin })}</span>
                <span>{t("subscription.plans.memberCount.sliderMax", { count: maxEmployees })}</span>
              </div>
            ) : (
              <div className="grid grid-cols-3 items-center gap-1 text-xs text-muted-foreground">
                <span className="text-left">
                  {t("subscription.plans.memberCount.sliderMin", { count: memberSliderMin })}
                </span>
                <span className="text-center">
                  {isEnterprisePlan
                    ? t("subscription.plans.enterprise.pricingLabel")
                    : t("subscription.plans.memberCount.sliderPerMember", {
                        amount: formatIDR(plan.base_price_per_member),
                      })}
                </span>
                <span className="text-right">
                  {t("subscription.plans.memberCount.sliderMax", { count: maxEmployees })}
                </span>
              </div>
            )}
          </div>

          {usesTermSelector ? (
            <BillingTermSelector
              value={billingTermMonths}
              onChange={(months) => onBillingTermChange?.(plan.id, months)}
              disabledTerms={isEnterprisePlan ? [1] : []}
              disabled={isTrialPlan || billingDowngradeBlocked}
            />
          ) : (
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{t("subscription.plans.billingCycle.yearly")}</Label>
              <Switch
                checked={billingCycle === "yearly"}
                onCheckedChange={
                  isTrialPlan || billingDowngradeBlocked
                    ? undefined
                    : (checked) => onBillingCycleChange(plan.id, checked)
                }
                disabled={isTrialPlan || billingDowngradeBlocked}
                className={isTrialPlan || billingDowngradeBlocked ? "pointer-events-none opacity-50" : ""}
              />
            </div>
          )}

          <div className="space-y-3 text-left">
            <h4 className="font-medium text-foreground">{t("subscription.plans.features.title")}</h4>
            <ul className="space-y-2">
              {dashboardFeature && (
                <li key="feat-dashboard" className="flex items-start space-x-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-blue" />
                  <span className="text-sm text-muted-foreground">{dashboardFeature}</span>
                </li>
              )}
              {showDynamicMemberAllowed && (
                <li key="feat-member-allowed-dynamic" className="flex items-start space-x-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-blue" />
                  <span className="text-sm text-muted-foreground">
                    {t("subscription.plans.features.memberAllowed", { count: memberCount })}
                  </span>
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
                    {formatPlanModuleLine(moduleRow.labelKey, t)}
                  </span>
                </li>
              ))}
              {customerSupportLabelKey && (
                <li key="feat-customer-support" className="flex items-start space-x-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-blue" />
                  <span className="text-sm text-muted-foreground">{t(customerSupportLabelKey)}</span>
                </li>
              )}
              <li key="feat-custom-modules" className="flex items-start space-x-2">
                {customModulesEnabled ? (
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-blue" />
                ) : (
                  <X className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
                )}
                <span
                  className={cn(
                    "text-sm",
                    customModulesEnabled ? "text-muted-foreground" : "text-muted-foreground/80",
                  )}
                >
                  {t("subscription.plans.features.customModules")}
                </span>
              </li>
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
            {!hideInlineAddOns && !isEnterprisePlan && catalogLinks.length > 0 && (
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
                isTrialPlan={isTrialPlan}
                isMidCycleActive={isMidCycleActive}
                isExpired={subscriptionStatus?.is_expired ?? false}
                leadMagnetActive={subscriptionStatus?.lead_magnet_active ?? false}
                posPaidOutletCount={posPaidOutletCount}
              />
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
                isEnterprisePlan
                  ? isComingSoon
                  : isComingSoon ||
                !canChange ||
                (isCurrent &&
                  memberCount === currentMemberCount &&
                  !hasBillingCycleChange &&
                  !isRenewEligible &&
                  !hasCheckoutableAddOnChanges &&
                  !hasSchedulableDowngrade) ||
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
            {isCurrent && showCompactAddOnSummary && !relocateAddOnDetail && (
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

          {!isEnterprisePlan && activeTermDiscount != null && activeTermDiscount > 0 && (
            <div className="text-center text-sm font-medium text-brand-blue">
              {usesTermSelector
                ? t("subscription.plans.savingsTerm", { percentage: activeTermDiscount })
                : t("subscription.plans.savings", { percentage: activeTermDiscount })}
            </div>
          )}

          {!isEnterprisePlan && (
            <PlanCardPriceBreakdown
              plan={plan}
              memberCount={memberCount}
              billingCycle={billingCycle}
              periodMonths={periodMonths}
              termLabel={termLabel}
              totalPrice={totalPrice}
              hrTermGross={hrTermGross}
              activeTermDiscount={activeTermDiscount}
              catalogLinks={catalogLinks}
              addOnSelections={addOnSelections}
              selectedCatalogAddonTotal={selectedCatalogAddonTotal}
              addonTotalForHero={addonTotalForHero}
              relocateAddOnDetail={relocateAddOnDetail}
              hideInlineAddOns={hideInlineAddOns}
              displayHeroTotal={displayHeroTotal}
              lastPaidAmount={lastPaidAmount}
              lastPaidMemberCount={lastPaidMemberCount}
              isCurrent={isCurrent}
            />
          )}

          {plan.demo_required && (
            <p className="text-center text-xs text-muted-foreground">{t("subscription.plans.demoRequired")}</p>
          )}
        </CardContent>
      </Card>
    );
  },
);

PlanCard.displayName = "PlanCard";
