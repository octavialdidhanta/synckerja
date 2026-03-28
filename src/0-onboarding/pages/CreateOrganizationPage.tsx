import { useLayoutEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/shared/lib/supabaseClient";
import OrganizationForm from "@/0-onboarding/components/OrganizationForm";
import { OnboardingSplitLayout } from "@/0-onboarding/components/OnboardingSplitLayout";

export default function CreateOrganizationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => {
    let cancelled = false;
    setLoading(true);

    const run = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;

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

      const { data: uoList, error: uoErr } = await supabase
        .from("user_organizations")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1);

      if (cancelled) return;

      if (uoErr) {
        console.warn("user_organizations guard:", uoErr);
      }

      if (uoList?.length) {
        const orgId = uoList[0].organization_id;
        const { data: subs } = await supabase
          .from("organization_subscriptions")
          .select("id")
          .eq("organization_id", orgId)
          .limit(1);
        if (cancelled) return;
        if (subs?.length) {
          navigate(localStorage.getItem("hasSeenEmployeeWelcome") ? "/" : "/employee-welcome", {
            replace: true,
          });
        } else {
          navigate("/create-plan", { replace: true });
        }
        return;
      }

      if (!cancelled) setLoading(false);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [navigate, location.key]);

  if (loading) {
    return (
      <OnboardingSplitLayout scrollClassName="items-center justify-center">
        <div className="flex w-full max-w-md flex-col items-center rounded-2xl border border-slate-200/80 bg-white px-6 py-10 text-center shadow-sm">
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-[hsl(var(--brand-blue))]" />
          <h2 className="mb-2 text-xl font-bold text-slate-900">{t("onboarding.org.loadingTitle")}</h2>
          <p className="text-sm text-slate-600">{t("onboarding.org.loadingDesc")}</p>
        </div>
      </OnboardingSplitLayout>
    );
  }

  return (
    <OnboardingSplitLayout scrollClassName="items-start">
      <div className="mx-auto w-full max-w-2xl space-y-8">
        <div>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="-ml-2 mb-4 gap-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            onClick={() => navigate("/login")}
          >
            <ArrowLeft className="h-4 w-4" />
            {t("onboarding.org.backLogin")}
          </Button>

          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {t("onboarding.org.pageTitle")}
            </h1>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">{t("onboarding.org.pageSubtitle")}</p>
          </div>
        </div>

        <OrganizationForm />
      </div>
    </OnboardingSplitLayout>
  );
}
