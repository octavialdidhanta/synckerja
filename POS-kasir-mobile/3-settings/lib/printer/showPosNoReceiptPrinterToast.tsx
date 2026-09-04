import { ToastAction } from "@/shared/components/ui/toast";
import type { toast as toastFn } from "@/shared/hooks/use-toast";
import { POS_SETTINGS_I18N } from "../posSettingsCopy";
import { posPrinterSettingsPath } from "./posPrinterAssign";

type ToastApi = typeof toastFn;
type Translate = (key: string, fallback?: string) => string;

/**
 * Toast when Print Bill / receipt fails because no printer has Receipt/Bill role.
 * Offers a one-tap jump to Settings → Hardware → Printer.
 */
export function showPosNoReceiptPrinterToast(args: {
  toast: ToastApi;
  t: Translate;
  navigate: (path: string) => void;
}): void {
  const { toast, t, navigate } = args;
  toast({
    title: t(POS_SETTINGS_I18N.printerNoReceiptPrinter, "No printer assigned for Receipt/Bill"),
    description: t(
      POS_SETTINGS_I18N.printerNoReceiptPrinterHint,
      "Open Settings → Printer, tap Refresh, pick your Bluetooth printer, then Save with Receipt/Bill on.",
    ),
    variant: "destructive",
    action: (
      <ToastAction
        altText={t(POS_SETTINGS_I18N.printerOpenSettings, "Open Settings")}
        onClick={() => navigate(posPrinterSettingsPath())}
      >
        {t(POS_SETTINGS_I18N.printerOpenSettings, "Open Settings")}
      </ToastAction>
    ),
  });
}
