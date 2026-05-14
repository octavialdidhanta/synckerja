import type { TFunction } from "i18next";
import { Label } from "@/shared/components/ui/label";
import { Slider } from "@/shared/components/ui/slider";
import { Switch } from "@/shared/components/ui/switch";
import { cn } from "@/shared/lib/utils";
import type { SubscriptionPlanRow } from "@/0-onboarding/types/subscriptionPlan";
import type { OnboardingPlanKind } from "@/0-onboarding/utils/subscriptionPlanUtils";
import { parseFeatures } from "@/0-onboarding/utils/subscriptionPlanUtils";
import { displayTotalForBillingCycle } from "@/0-onboarding/utils/subscriptionPlanPricing";

const brandBlue = "hsl(var(--brand-blue))";

export type CreatePlanPlanCardProps = {
  plan: SubscriptionPlanRow;
  kind: OnboardingPlanKind;
  maxMembers: number;
  selected: boolean;
  catalogSelectable: boolean;
  canSubscribeWithoutPayment: boolean;
  memberCount: number;
  onMemberCountChange: (n: number) => void;
  billingCycle: "monthly" | "yearly";
  onBillingCycleChange: (yearly: boolean) => void;
  onSelect: () => void;
  formatMoney: (n: number) => string;
  t: TFunction;
};

function isComingSoonDescription(description: string | null): boolean {
  if (!description) return false;
  const d = description.toLowerCase();
  return d.includes("coming soon") || d.includes("comming soon");
}

export function CreatePlanPlanCard({
  plan,
  kind,
  maxMembers,
  selected,
  catalogSelectable,
  canSubscribeWithoutPayment,
  memberCount,
  onMemberCountChange,
  billingCycle,
  onBillingCycleChange,
  formatMoney,
  onSelect,
  t,
}: CreatePlanPlanCardProps) {
  const features = parseFeatures(plan.features);
  const isYearly = billingCycle === "yearly";
  const total = displayTotalForBillingCycle(plan, memberCount, billingCycle);
  const monthlySubtotal = Number(plan.base_price_per_member) * memberCount;
  const rawYearlyBeforeDiscount = monthlySubtotal * 12;
  const comingSoon = isComingSoonDescription(plan.description);
  const pct = plan.annual_discount_percentage;
  const cardInactive = !catalogSelectable || comingSoon;

  return (
    <div
      role="button"
      tabIndex={cardInactive ? -1 : 0}
      aria-disabled={cardInactive}
      onClick={() => {
        if (cardInactive) return;
        onSelect();
      }}
      onKeyDown={(e) => {
        if (cardInactive) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "flex h-full min-h-0 w-full flex-col rounded-xl border-2 p-6 text-left transition-colors sm:p-7",
        cardInactive && "cursor-not-allowed opacity-60",
        !cardInactive && "cursor-pointer",
        selected && catalogSelectable
          ? "border-[hsl(var(--brand-blue))] bg-[hsl(var(--brand-blue))]/5 shadow-sm"
          : "border-slate-200 bg-white hover:border-[hsl(var(--brand-blue))]/35",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-lg font-semibold capitalize text-slate-900">{plan.name}</span>
        <span className="text-sm font-semibold" style={{ color: brandBlue }}>
          {formatMoney(Number(plan.base_price_per_member))}
          <span className="font-normal text-slate-500"> {t("onboarding.plan.perMember")}</span>
        </span>
      </div>

      {plan.description ? (
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{plan.description}</p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-2">
        {plan.jumlah_hari_trial != null && plan.jumlah_hari_trial > 0 ? (
          <span className="inline-flex rounded-md bg-brand-blue/10 px-2 py-0.5 text-xs font-medium text-[hsl(var(--brand-blue))]">
            {t("onboarding.plan.trialDays", { days: plan.jumlah_hari_trial })}
          </span>
        ) : null}
        {kind === "free_forever" ? (
          <span className="inline-flex rounded-md bg-brand-blue/10 px-2 py-0.5 text-xs font-medium text-[hsl(var(--brand-blue))]">
            {t("onboarding.plan.freeForeverBadge")}
          </span>
        ) : null}
        {!canSubscribeWithoutPayment ? (
          <span className="inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
            {t("onboarding.plan.paidRequiresBilling")}
          </span>
        ) : null}
      </div>

      {pct != null && pct > 0 ? (
        <p className="mt-2 text-xs text-slate-500">{t("onboarding.plan.annualDiscount", { pct })}</p>
      ) : null}

      {plan.demo_required ? (
        <p className="mt-2 text-xs font-medium text-amber-800">{t("onboarding.plan.demoBadge")}</p>
      ) : null}
      {plan.is_custom ? (
        <p className="mt-2 text-xs font-medium text-slate-600">{t("onboarding.plan.customBadge")}</p>
      ) : null}

      <div className="mt-4 space-y-1">
        <p className="text-2xl font-bold text-slate-900">{formatMoney(total)}</p>
        <p className="text-xs text-slate-500">
          {t("onboarding.plan.perPeriodForMembers", {
            period: t(isYearly ? "onboarding.plan.periodYear" : "onboarding.plan.periodMonth"),
            count: memberCount,
          })}
        </p>
      </div>

      <div
        className="mt-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="presentation"
      >
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm font-medium text-slate-800">
            {t("onboarding.plan.memberCount", { count: memberCount })}
          </Label>
          <span className="text-xs text-slate-500">{t("onboarding.plan.memberMaxHint", { max: maxMembers })}</span>
        </div>
        <Slider
          value={[memberCount]}
          min={1}
          max={maxMembers}
          step={1}
          disabled={!canSubscribeWithoutPayment || comingSoon}
          onValueChange={(v) => onMemberCountChange(v[0] ?? 1)}
          className="w-full [&_[data-orientation=horizontal]_.bg-primary]:bg-[hsl(var(--brand-blue))]"
        />
        <div className="flex justify-between text-xs text-slate-500">
          <span>{t("onboarding.plan.oneMember")}</span>
          <span>{t("onboarding.plan.nMembers", { n: maxMembers })}</span>
        </div>
      </div>

      <div
        className="mt-5 space-y-2 rounded-lg border border-slate-100 bg-slate-50/80 p-3"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="presentation"
      >
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`billing-${plan.id}`} className="text-sm font-medium text-slate-800">
            {t("onboarding.plan.billingYearlyLabel")}
          </Label>
          <Switch
            id={`billing-${plan.id}`}
            checked={isYearly}
            onCheckedChange={onBillingCycleChange}
            disabled={comingSoon}
            className="data-[state=checked]:bg-[hsl(var(--brand-blue))]"
          />
        </div>
        {isYearly && pct != null && pct > 0 ? (
          <p className="text-xs font-medium text-[hsl(var(--brand-blue))]">
            {t("onboarding.plan.billingYearlySave", { pct })}
          </p>
        ) : null}
        <p className="text-xs text-slate-500">{t("onboarding.plan.billingCycleNote")}</p>
      </div>

      {features.length > 0 ? (
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
        <div className="flex justify-between text-slate-600">
          <span>{t("onboarding.plan.pricePerMemberLabel")}</span>
          <span className="font-medium text-slate-900">{formatMoney(Number(plan.base_price_per_member))}</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>{t(isYearly ? "onboarding.plan.subtotalYearly" : "onboarding.plan.subtotalMonthly")}</span>
          <span className="font-medium text-slate-900">
            {formatMoney(isYearly ? rawYearlyBeforeDiscount : monthlySubtotal)}
          </span>
        </div>
        {isYearly && pct != null && pct > 0 ? (
          <div className="flex justify-between text-xs text-[hsl(var(--brand-blue))]">
            <span>{t("onboarding.plan.annualDiscount", { pct })}</span>
            <span>{formatMoney(total)}</span>
          </div>
        ) : null}
        <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-bold text-slate-900">
          <span>{t(isYearly ? "onboarding.plan.totalYearly" : "onboarding.plan.totalMonthly")}</span>
          <span>{formatMoney(total)}</span>
        </div>
      </div>

      {comingSoon ? (
        <p className="mt-3 text-center text-xs font-medium text-slate-500">Coming soon</p>
      ) : null}
    </div>
  );
}
