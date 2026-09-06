import { Capacitor } from "@capacitor/core";
import { ChevronRight, LifeBuoy, Mail } from "lucide-react";
import {
  SUPPORT_EMAIL,
  supportMailtoHref,
} from "@/help/constants/helpContact";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
import { POS_SETTINGS_I18N } from "../../lib/posSettingsCopy";

const HELP_CENTER_URL = "https://help.synckerja.com";
const SUPPORT_SUBJECT = "Synckerja POS Support";

function openMailto(mailtoUrl: string): void {
  try {
    const anchor = document.createElement("a");
    anchor.href = mailtoUrl;
    anchor.rel = "noopener noreferrer";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } catch {
    window.location.href = mailtoUrl;
  }
}

async function openExternalUrl(url: string): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url });
      return;
    }
  } catch {
    /* fall through */
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Account → Help — compact support contacts (email + help center).
 */
export function PosSupportSettingsPanel() {
  const { t } = useAppTranslation();

  return (
    <div className={POS_PANEL.body}>
      <p className="mb-3 px-0.5 text-sm leading-snug text-slate-500">
        {t(
          POS_SETTINGS_I18N.supportIntro,
          "Need help with Synckerja POS? Reach our team or browse the help center.",
        )}
      </p>

      <div className={POS_PANEL.card}>
        <button
          type="button"
          onClick={() => openMailto(supportMailtoHref(SUPPORT_SUBJECT))}
          className={cn(POS_PANEL.row, "text-left hover:bg-slate-50")}
        >
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
            <Mail className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-slate-900">
              {t(POS_SETTINGS_I18N.supportEmailLabel, "Email support")}
            </span>
            <span className="mt-0.5 block truncate text-xs text-slate-500">
              {t(POS_SETTINGS_I18N.supportEmailHint, SUPPORT_EMAIL)}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300" aria-hidden />
        </button>

        <button
          type="button"
          onClick={() => void openExternalUrl(HELP_CENTER_URL)}
          className={cn(POS_PANEL.row, "text-left hover:bg-slate-50")}
        >
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
            <LifeBuoy className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-slate-900">
              {t(POS_SETTINGS_I18N.supportHelpCenterLabel, "Help center")}
            </span>
            <span className="mt-0.5 block truncate text-xs text-slate-500">
              {t(POS_SETTINGS_I18N.supportHelpCenterHint, "help.synckerja.com")}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300" aria-hidden />
        </button>
      </div>
    </div>
  );
}
