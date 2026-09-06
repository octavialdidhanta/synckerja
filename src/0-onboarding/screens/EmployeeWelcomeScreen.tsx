import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import type { ReactNode } from "react";
import { SynckerjaBrandMark } from "@/shared/components/mobile/SynckerjaBrandMark";
import { PosBrandMark } from "@/pos-mobile/shared/components/PosBrandMark";
import { isPosAuthSurface } from "@/pos-mobile/0-auth/lib/posAuthSurface";
import { POS_AUTH_PATHS } from "@/pos-mobile/0-auth/lib/posAuthPaths";
import { cn } from "@/shared/lib/utils";

const brandRed = "hsl(var(--brand-red))";

function defaultEmployeeWelcomeBrand() {
  return isPosAuthSurface() ? (
    <PosBrandMark className="!-mb-2" />
  ) : (
    <SynckerjaBrandMark size="splash" className="!-mb-2" />
  );
}

export function EmployeeWelcomeSpinner() {
  return (
    <div className="h-10 w-10 animate-spin rounded-full border-2 border-[hsl(var(--brand-blue))] border-t-transparent" />
  );
}

export function EmployeeWelcomeContent({
  brandMark,
}: {
  /** `undefined` = default brand; `null` = chrome already shows brand. */
  brandMark?: ReactNode | null;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const mark = brandMark === undefined ? defaultEmployeeWelcomeBrand() : brandMark;
  const chromeHosted = mark == null;

  const onContinue = () => {
    localStorage.setItem("hasSeenEmployeeWelcome", "true");
    navigate(isPosAuthSurface() ? POS_AUTH_PATHS.selectOutlet : "/", { replace: true });
  };

  return (
    <div
      className={cn(
        "w-full max-w-lg",
        !chromeHosted && "-translate-y-10 sm:-translate-y-12",
      )}
    >
      {mark ? <div className="flex w-full justify-center">{mark}</div> : null}
      <div
        className={cn(
          "space-y-4",
          // Chrome already pulls children up (`-mt-12`); do not stack another negative margin
          // or the title overlaps the logo.
          !chromeHosted && "-mt-1 -translate-y-5 sm:-translate-y-6",
        )}
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {t("onboarding.welcome.title")}
          </h1>
          <p className="mt-1 text-sm text-slate-600 sm:text-base">{t("onboarding.welcome.subtitle")}</p>
        </div>

        <Button
          className="h-12 w-full text-base font-semibold text-white shadow-md transition-colors hover:opacity-[0.92]"
          style={{ backgroundColor: brandRed }}
          onClick={onContinue}
        >
          {t("onboarding.welcome.cta")}
        </Button>
      </div>
    </div>
  );
}
