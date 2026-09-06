import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { supabase } from "@/shared/lib/supabaseClient";
import { toast } from "@/shared/hooks/use-toast";
import { CreatePlanPlanCard } from "@/0-onboarding/components/CreatePlanPlanCard";
import { useSubscriptionPlans } from "@/0-onboarding/hooks/useSubscriptionPlans";
import { useCreateOnboardingSubscription } from "@/0-onboarding/hooks/useCreateOnboardingSubscription";
import { effectiveOrganizationId, readNewOrganizationIdFromSession } from "@/0-onboarding/hooks/useOnboardingOrganizationId";
import type { SubscriptionPlanRow } from "@/0-onboarding/types/subscriptionPlan";
import {
  classifyOnboardingPlan,
  defaultMemberCountForKind,
  defaultPaidPlanMemberCount,
  onboardingCanSubscribeWithoutPayment,
  planSelectable,
  planUsesPerMemberPricing,
  resolveFreePlanMaxMembers,
  resolvePaidPlanMemberFloor,
  sliderMaxMembers,
} from "@/0-onboarding/utils/subscriptionPlanUtils";
import { SynckerjaBrandMark } from "@/shared/components/mobile/SynckerjaBrandMark";
import { PosBrandMark } from "@/pos-mobile/shared/components/PosBrandMark";
import { isPosAuthSurface } from "@/pos-mobile/0-auth/lib/posAuthSurface";

const brandRed = "hsl(var(--brand-red))";

function defaultPlanBrand() {
  return isPosAuthSurface() ? <PosBrandMark /> : <SynckerjaBrandMark size="splash" />;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function clearOnboardingSessionFlags() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem("organizationJustCreated");
  sessionStorage.removeItem("newOrganizationId");
  sessionStorage.removeItem("forceRefreshUserData");
}

export type CreatePlanFlowProps = {
  brandMark?: ReactNode;
};

export function CreatePlanFlow({ brandMark }: CreatePlanFlowProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const mark = brandMark ?? defaultPlanBrand();

  const [gatePhase, setGatePhase] = useState<"loading" | "ready" | "error">("loading");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [gateErrorMessage, setGateErrorMessage] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [billingCycles, setBillingCycles] = useState<Record<string, "monthly" | "yearly">>({});
  const [countsReady, setCountsReady] = useState(false);

  const formatMoney = useCallback(
    (n: number) =>
      new Intl.NumberFormat(i18n.language === "id" ? "id-ID" : "en-US", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      }).format(Number(n)),
    [i18n.language],
  );

  const { data: plans = [], isLoading: plansLoading, isError: plansIsError, error: plansError } = useSubscriptionPlans(
    gatePhase === "ready" && !!orgId,
  );

  const paidMemberFloor = useMemo(
    () => resolvePaidPlanMemberFloor(resolveFreePlanMaxMembers(plans)),
    [plans],
  );

  const { mutateAsync: createSubscription, isPending: creating } = useCreateOnboardingSubscription();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setGatePhase("loading");
      setGateErrorMessage(null);

      const { data: auth } = await supabase.auth.getUser();
      if (cancelled) return;
      const user = auth.user;
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }

      const email = (user.email ?? "").trim();
      const { data: hasVerifiedToken, error: verifyRpcError } = await supabase.rpc(
        "registration_has_verified_email",
        { p_user_id: user.id, p_email: email },
      );
      if (cancelled) return;
      if (verifyRpcError || !hasVerifiedToken) {
        navigate("/register", { replace: true });
        return;
      }

      const fetchUo = async () => {
        const { data } = await supabase
          .from("user_organizations")
          .select("organization_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();
        return data?.organization_id ?? null;
      };

      let uoOrgId = await fetchUo();
      const organizationJustCreated =
        typeof sessionStorage !== "undefined" && sessionStorage.getItem("organizationJustCreated") === "true";

      let effective = effectiveOrganizationId(uoOrgId);
      if (!effective && organizationJustCreated) {
        for (let i = 0; i < 25 && !cancelled; i++) {
          await sleep(200);
          if (readNewOrganizationIdFromSession()) {
            effective = effectiveOrganizationId(await fetchUo());
            break;
          }
          uoOrgId = await fetchUo();
          effective = effectiveOrganizationId(uoOrgId);
          if (effective) break;
        }
      } else {
        effective = effectiveOrganizationId(uoOrgId);
      }

      if (cancelled) return;

      if (!effective) {
        navigate("/create-organization", { replace: true });
        return;
      }

      const { data: subs, error: subErr } = await supabase
        .from("organization_subscriptions")
        .select("id")
        .eq("organization_id", effective)
        .limit(1);

      if (cancelled) return;
      if (subErr) {
        console.error(subErr);
        setGateErrorMessage(subErr.message);
        setGatePhase("error");
        return;
      }

      if (subs?.length) {
        navigate(localStorage.getItem("hasSeenEmployeeWelcome") ? "/" : "/employee-welcome", { replace: true });
        return;
      }

      setOrgId(effective);
      setGatePhase("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    if (!plans.length || countsReady) return;

    const nextCounts: Record<string, number> = {};
    const nextBilling: Record<string, "monthly" | "yearly"> = {};
    let firstChoice: string | null = null;

    for (const p of plans) {
      const kind = classifyOnboardingPlan(p);
      const max = sliderMaxMembers(p, kind);
      nextCounts[p.id] =
        kind === "paid_requires_billing"
          ? defaultPaidPlanMemberCount(paidMemberFloor, max)
          : defaultMemberCountForKind(kind, max);
      nextBilling[p.id] = "monthly";
      if (!firstChoice && planSelectable(p) && onboardingCanSubscribeWithoutPayment(p)) {
        firstChoice = p.id;
      }
    }

    setMemberCounts(nextCounts);
    setBillingCycles(nextBilling);
    setSelectedId(firstChoice ?? plans.find((p) => planSelectable(p))?.id ?? plans[0]?.id ?? null);
    setCountsReady(true);
  }, [plans, countsReady, paidMemberFloor]);

  useEffect(() => {
    if (!plans.length || !countsReady) return;
    setMemberCounts((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const p of plans) {
        const kind = classifyOnboardingPlan(p);
        const max = sliderMaxMembers(p, kind);
        const minMembers = kind === "paid_requires_billing" ? paidMemberFloor : 1;
        const v = next[p.id] ?? minMembers;
        if (v > max) {
          next[p.id] = max;
          changed = true;
        } else if (v < minMembers) {
          next[p.id] = minMembers;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [plans, countsReady, paidMemberFloor]);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedId) ?? null,
    [plans, selectedId],
  );

  const canSubmit = useMemo(() => {
    if (!orgId || !selectedPlan || !planSelectable(selectedPlan)) return false;
    return onboardingCanSubscribeWithoutPayment(selectedPlan);
  }, [orgId, selectedPlan]);

  const onContinue = async () => {
    if (!orgId || !selectedPlan || !canSubmit) return;
    try {
      await createSubscription({
        organizationId: orgId,
        plan: selectedPlan,
        memberCount: memberCounts[selectedPlan.id] ?? 1,
        billingCycle: billingCycles[selectedPlan.id] ?? "monthly",
      });
      clearOnboardingSessionFlags();
      navigate("/employee-welcome", { replace: true });
    } catch (e: unknown) {
      const code = e instanceof Error ? e.message : String(e);
      if (code === "ONBOARDING_PAID_REQUIRES_BILLING") {
        toast({
          title: t("onboarding.plan.paidRequiresBilling"),
          description: t("onboarding.plan.paidRequiresBillingDesc"),
          variant: "destructive",
        });
        return;
      }
      console.error(e);
      toast({ title: t("onboarding.plan.error"), variant: "destructive" });
    }
  };

  const handleSelectPlan = (p: SubscriptionPlanRow) => {
    if (!planSelectable(p)) {
      if (p.demo_required) {
        toast({
          title: t("onboarding.plan.demoRequiredTitle"),
          description: t("onboarding.plan.demoRequiredDesc"),
        });
      } else if (p.is_custom) {
        toast({
          title: t("onboarding.plan.customPlanTitle"),
          description: t("onboarding.plan.customPlanDesc"),
        });
      }
      return;
    }
    setSelectedId(p.id);
  };

  if (gatePhase === "loading") {
    return (
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-[hsl(var(--brand-blue))] border-t-transparent" />
    );
  }

  if (gatePhase === "error" && gateErrorMessage) {
    return (
      <div className="w-full max-w-md rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center text-sm text-red-800">
        {t("onboarding.plan.loadError")}
        <p className="mt-2 font-mono text-xs opacity-80">{gateErrorMessage}</p>
      </div>
    );
  }

  if (plansLoading) {
    return (
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-[hsl(var(--brand-blue))] border-t-transparent" />
    );
  }

  if (plansIsError) {
    const msg = plansError instanceof Error ? plansError.message : String(plansError ?? "");
    return (
      <div className="w-full max-w-md rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center text-sm text-red-800">
        {t("onboarding.plan.loadError")}
        <p className="mt-2 font-mono text-xs opacity-80">{msg}</p>
      </div>
    );
  }

  if (!plans.length) {
    return <p className="text-center text-sm text-slate-600">{t("onboarding.plan.empty")}</p>;
  }

  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-6 pb-4 lg:max-w-[1400px] lg:gap-8 xl:max-w-[1520px]">
      <header className="flex w-full max-w-md flex-col items-center text-center lg:max-w-xl">
        <div className="flex justify-center">{mark}</div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl lg:text-3xl">
          {t("onboarding.plan.title")}
        </h1>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">{t("onboarding.plan.subtitle")}</p>
      </header>

      {/* Mobile: vertical stack (one card per row). Desktop: horizontal carousel. */}
      <div className="w-full min-w-0 overflow-x-hidden lg:overflow-x-auto lg:overflow-y-visible lg:[overscroll-behavior-x:contain]">
        <div className="mx-auto flex w-full min-w-0 flex-col items-stretch gap-5 lg:w-max lg:max-w-full lg:flex-row lg:flex-nowrap lg:justify-center lg:gap-6 lg:px-1 lg:py-1 lg:pb-2">
          {plans.map((p) => {
            const kind = classifyOnboardingPlan(p);
            const max = sliderMaxMembers(p, kind);
            const catalogSelectable = planSelectable(p);
            const canSub = onboardingCanSubscribeWithoutPayment(p);
            const minMembers = planUsesPerMemberPricing(p) ? paidMemberFloor : 1;
            const count = Math.min(max, Math.max(minMembers, memberCounts[p.id] ?? minMembers));
            const cycle = billingCycles[p.id] ?? "monthly";
            return (
              <div
                key={p.id}
                className="mx-auto flex h-auto w-full max-w-md shrink-0 lg:mx-0 lg:min-h-[28rem] lg:w-[26rem] lg:max-w-none lg:flex-none xl:w-[28rem]"
              >
                <CreatePlanPlanCard
                  plan={p}
                  kind={kind}
                  maxMembers={max}
                  minMembers={minMembers}
                  selected={p.id === selectedId}
                  catalogSelectable={catalogSelectable}
                  canSubscribeWithoutPayment={canSub}
                  memberCount={count}
                  onMemberCountChange={(n) =>
                    setMemberCounts((prev) => ({
                      ...prev,
                      [p.id]: Math.min(max, Math.max(minMembers, n)),
                    }))
                  }
                  billingCycle={cycle}
                  onBillingCycleChange={(yearly) =>
                    setBillingCycles((prev) => ({ ...prev, [p.id]: yearly ? "yearly" : "monthly" }))
                  }
                  onSelect={() => handleSelectPlan(p)}
                  formatMoney={formatMoney}
                  t={t}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex w-full max-w-md justify-center px-0 lg:max-w-none">
        <Button
          className="h-11 w-full text-base font-semibold text-white shadow-md transition-colors hover:opacity-[0.92] sm:h-12 sm:min-w-[11rem] sm:w-auto sm:px-10"
          style={{ backgroundColor: brandRed }}
          onClick={onContinue}
          disabled={creating || !canSubmit || !orgId}
        >
          {creating ? t("onboarding.plan.submitting") : t("onboarding.plan.submit")}
        </Button>
      </div>
    </div>
  );
}
