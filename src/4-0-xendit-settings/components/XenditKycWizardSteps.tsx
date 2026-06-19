import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";

type XenditKycWizardStepsProps = {
  step: 1 | 2 | 3;
};

const STEPS = [
  { id: 1, key: "xendit.kyc.stepProfile", default: "Profil" },
  { id: 2, key: "xendit.kyc.stepDocuments", default: "Dokumen legal" },
  { id: 3, key: "xendit.kyc.stepBusiness", default: "Bisnis & payout" },
] as const;

export function XenditKycWizardSteps({ step }: XenditKycWizardStepsProps) {
  const { t } = useTranslation();

  return (
    <ol className="mb-4 flex items-center gap-2 text-[11px]">
      {STEPS.map((s, index) => (
        <li key={s.id} className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-medium",
              step >= s.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-gray-300 bg-white text-gray-500",
            )}
          >
            {s.id}
          </span>
          <span
            className={cn(
              "truncate font-medium",
              step >= s.id ? "text-gray-900" : "text-gray-500",
            )}
          >
            {t(s.key, s.default)}
          </span>
          {index < STEPS.length - 1 ? (
            <span className="mx-1 hidden h-px flex-1 bg-gray-200 sm:block" aria-hidden />
          ) : null}
        </li>
      ))}
    </ol>
  );
}
