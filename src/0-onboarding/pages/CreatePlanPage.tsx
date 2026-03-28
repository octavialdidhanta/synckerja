import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { supabase } from "@/shared/lib/supabaseClient";
import { toast } from "@/shared/hooks/use-toast";
import { cn } from "@/shared/lib/utils";
import { CreatePlanPlanCard } from "@/0-onboarding/components/CreatePlanPlanCard";
import { useSubscriptionPlans } from "@/0-onboarding/hooks/useSubscriptionPlans";
import { useCreateOnboardingSubscription } from "@/0-onboarding/hooks/useCreateOnboardingSubscription";
import { effectiveOrganizationId, readNewOrganizationIdFromSession } from "@/0-onboarding/hooks/useOnboardingOrganizationId";
import type { SubscriptionPlanRow } from "@/0-onboarding/types/subscriptionPlan";
import {
  classifyOnboardingPlan,
  defaultMemberCountForKind,
  onboardingCanSubscribeWithoutPayment,
  planSelectable,
  sliderMaxMembers,
} from "@/0-onboarding/utils/subscriptionPlanUtils";

const brandRed = "hsl(var(--brand-red))";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function clearOnboardingSessionFlags() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem("organizationJustCreated");
  sessionStorage.removeItem("newOrganizationId");
  sessionStorage.removeItem("forceRefreshUserData");
}

function CreatePlanPageShell({
  children,
  scrollClassName,
}: {
  children: ReactNode;
  scrollClassName?: string;
}) {
  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-[hsl(var(--brand-white))] safe-area-top">
      <div
        className={cn(
          "mx-auto flex min-h-0 w-full max-w-[1920px] flex-1 flex-col px-5 py-8 sm:px-10 lg:py-10",
          "overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain",
          scrollClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export default function CreatePlanPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

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
      nextCounts[p.id] = defaultMemberCountForKind(kind, max);
      nextBilling[p.id] = "monthly";
      if (!firstChoice && planSelectable(p) && onboardingCanSubscribeWithoutPayment(p)) {
        firstChoice = p.id;
      }
    }

    setMemberCounts(nextCounts);
    setBillingCycles(nextBilling);
    setSelectedId(firstChoice ?? plans.find((p) => planSelectable(p))?.id ?? plans[0]?.id ?? null);
    setCountsReady(true);
  }, [plans, countsReady]);

  useEffect(() => {
    if (!plans.length || !countsReady) return;
    setMemberCounts((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const p of plans) {
        const kind = classifyOnboardingPlan(p);
        const max = sliderMaxMembers(p, kind);
        const v = next[p.id] ?? 1;
        if (v > max) {
          next[p.id] = max;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [plans, countsReady]);

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
      <CreatePlanPageShell scrollClassName="items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[hsl(var(--brand-blue))] border-t-transparent" />
      </CreatePlanPageShell>
    );
  }

  if (gatePhase === "error" && gateErrorMessage) {
    return (
      <CreatePlanPageShell scrollClassName="items-center justify-center">
        <div className="w-full max-w-md rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center text-sm text-red-800">
          {t("onboarding.plan.loadError")}
          <p className="mt-2 font-mono text-xs opacity-80">{gateErrorMessage}</p>
        </div>
      </CreatePlanPageShell>
    );
  }

  if (plansLoading) {
    return (
      <CreatePlanPageShell scrollClassName="items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[hsl(var(--brand-blue))] border-t-transparent" />
      </CreatePlanPageShell>
    );
  }

  if (plansIsError) {
    const msg = plansError instanceof Error ? plansError.message : String(plansError ?? "");
    return (
      <CreatePlanPageShell scrollClassName="items-center justify-center">
        <div className="w-full max-w-md rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center text-sm text-red-800">
          {t("onboarding.plan.loadError")}
          <p className="mt-2 font-mono text-xs opacity-80">{msg}</p>
        </div>
      </CreatePlanPageShell>
    );
  }

  if (!plans.length) {
    return (
      <CreatePlanPageShell scrollClassName="items-center justify-center">
        <p className="text-center text-sm text-slate-600">{t("onboarding.plan.empty")}</p>
      </CreatePlanPageShell>
    );
  }

  return (
    <CreatePlanPageShell scrollClassName="items-center justify-center">
      <div className="flex w-full min-w-0 max-w-[1400px] flex-col items-center gap-8 pb-4 xl:max-w-[1520px]">
        <header className="flex w-full flex-col items-center text-center">
          <div className="mb-4 flex justify-center">
            <img src="/favicon.png" alt="" className="h-14 w-auto" width={56} height={56} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {t("onboarding.plan.title")}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-600 sm:text-base">{t("onboarding.plan.subtitle")}</p>
        </header>

        <div className="w-full overflow-x-auto overflow-y-visible [overscroll-behavior-x:contain]">
          <div className="mx-auto flex w-max max-w-full flex-nowrap justify-center gap-5 px-1 py-1 pb-2 lg:gap-6">
            {plans.map((p) => {
              const kind = classifyOnboardingPlan(p);
              const max = sliderMaxMembers(p, kind);
              const catalogSelectable = planSelectable(p);
              const canSub = onboardingCanSubscribeWithoutPayment(p);
              const count = Math.min(max, Math.max(1, memberCounts[p.id] ?? 1));
              const cycle = billingCycles[p.id] ?? "monthly";
              return (
                <div
                  key={p.id}
                  className="flex h-auto w-[min(23rem,calc(100vw-1.5rem))] shrink-0 sm:w-[min(25rem,calc(100vw-2rem))] lg:min-h-[28rem] lg:w-[26rem] lg:flex-none xl:w-[28rem]"
                >
                  <CreatePlanPlanCard
                    plan={p}
                    kind={kind}
                    maxMembers={max}
                    selected={p.id === selectedId}
                    catalogSelectable={catalogSelectable}
                    canSubscribeWithoutPayment={canSub}
                    memberCount={count}
                    onMemberCountChange={(n) =>
                      setMemberCounts((prev) => ({ ...prev, [p.id]: Math.min(max, Math.max(1, n)) }))
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

        <div className="flex w-full justify-center">
          <Button
            className="h-12 min-w-[11rem] px-10 text-base font-semibold text-white shadow-md transition-colors hover:opacity-[0.92]"
            style={{ backgroundColor: brandRed }}
            onClick={onContinue}
            disabled={creating || !canSubmit || !orgId}
          >
            {creating ? t("onboarding.plan.submitting") : t("onboarding.plan.submit")}
          </Button>
        </div>
      </div>
    </CreatePlanPageShell>
  );
}
