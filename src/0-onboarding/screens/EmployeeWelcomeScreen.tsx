import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import type { ReactNode } from "react";
import { SynckerjaBrandLogo } from "@/shared/brand/brandLogo";

const brandRed = "hsl(var(--brand-red))";

const defaultBrand = <SynckerjaBrandLogo />;

export function EmployeeWelcomeSpinner() {
  return (
    <div className="h-10 w-10 animate-spin rounded-full border-2 border-[hsl(var(--brand-blue))] border-t-transparent" />
  );
}

export function EmployeeWelcomeContent({ brandMark = defaultBrand }: { brandMark?: ReactNode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const onContinue = () => {
    localStorage.setItem("hasSeenEmployeeWelcome", "true");
    navigate("/", { replace: true });
  };

  return (
    <div className="w-full max-w-lg space-y-8">
      <div className="flex flex-col">
        <div className="mb-2 flex w-full justify-center">{brandMark}</div>
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
  );
}
