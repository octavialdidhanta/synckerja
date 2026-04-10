import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import OrganizationForm from "@/0-onboarding/components/OrganizationForm";

export function CreateOrganizationLoadingCard() {
  const { t } = useTranslation();
  return (
    <div className="flex w-full max-w-md flex-col items-center rounded-2xl border border-slate-200/80 bg-white px-6 py-10 text-center shadow-sm">
      <Loader2 className="mb-4 h-8 w-8 animate-spin text-[hsl(var(--brand-blue))]" />
      <h2 className="mb-2 text-xl font-bold text-slate-900">{t("onboarding.org.loadingTitle")}</h2>
      <p className="text-sm text-slate-600">{t("onboarding.org.loadingDesc")}</p>
    </div>
  );
}

export function CreateOrganizationFormColumn() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
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
  );
}
