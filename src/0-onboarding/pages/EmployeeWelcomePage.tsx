import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { supabase } from "@/shared/lib/supabaseClient";
import { OnboardingSplitLayout } from "@/0-onboarding/components/OnboardingSplitLayout";

const brandRed = "hsl(var(--brand-red))";

export default function EmployeeWelcomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }
      const { data: uo } = await supabase
        .from("user_organizations")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (!uo?.organization_id) {
        navigate("/create-organization", { replace: true });
        return;
      }
      const { data: subs } = await supabase
        .from("organization_subscriptions")
        .select("id")
        .eq("organization_id", uo.organization_id)
        .limit(1);
      if (!subs?.length) {
        navigate("/create-plan", { replace: true });
        return;
      }
      setChecking(false);
    })();
  }, [navigate]);

  const onContinue = () => {
    localStorage.setItem("hasSeenEmployeeWelcome", "true");
    navigate("/", { replace: true });
  };

  if (checking) {
    return (
      <OnboardingSplitLayout scrollClassName="items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[hsl(var(--brand-blue))] border-t-transparent" />
      </OnboardingSplitLayout>
    );
  }

  return (
    <OnboardingSplitLayout scrollClassName="items-center justify-center">
      <div className="w-full max-w-lg space-y-8">
        <div className="flex flex-col">
          <div className="mb-5 flex w-full justify-center">
            <img src="/favicon.png" alt="" className="h-14 w-auto" width={56} height={56} />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {t("onboarding.welcome.title")}
            </h1>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">{t("onboarding.welcome.subtitle")}</p>
          </div>
        </div>

        <Button
          className="h-12 w-full text-base font-semibold text-white shadow-md transition-colors hover:opacity-[0.92]"
          style={{ backgroundColor: brandRed }}
          onClick={onContinue}
        >
          {t("onboarding.welcome.cta")}
        </Button>
      </div>
    </OnboardingSplitLayout>
  );
}
