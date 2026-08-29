import { Check } from "lucide-react";
import { useLanguage } from "@/shared/i18n/LanguageProvider";
import type { AppLanguage } from "@/shared/i18n/translationTypes";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { POS_SETTINGS_I18N } from "../../lib/posSettingsCopy";

const OPTIONS: {
  id: AppLanguage;
  labelKey: string;
  fallback: string;
}[] = [
  {
    id: "id",
    labelKey: POS_SETTINGS_I18N.languageOptionId,
    fallback: "Bahasa Indonesia",
  },
  {
    id: "en",
    labelKey: POS_SETTINGS_I18N.languageOptionEn,
    fallback: "English",
  },
];

/**
 * Account → Bahasa — device-only locale switch (same keys as app i18n).
 */
export function PosLanguageSettingsPanel() {
  const { t } = useAppTranslation();
  const { language, setLanguage } = useLanguage();
  const active: AppLanguage = language === "en" ? "en" : "id";

  return (
    <div className="px-4 py-2 pb-8">
      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        {OPTIONS.map((opt) => {
          const selected = active === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setLanguage(opt.id, { deviceOnly: true })}
              className={cn(
                "flex w-full items-center gap-3 border-b border-slate-100 px-3 py-3.5 text-left last:border-b-0",
                "hover:bg-slate-50",
              )}
            >
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
                {selected ? (
                  <Check className="h-5 w-5 text-primary" aria-hidden />
                ) : null}
              </span>
              <span className="min-w-0 flex-1 text-sm text-slate-900">
                {t(opt.labelKey, opt.fallback)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
