import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { POS_SETTINGS_I18N } from "../../../lib/posSettingsCopy";
import type { PosSavedPrinter } from "../../../lib/printer/posPrinterTypes";
import { PosPrinterListRow } from "./PosPrinterListRow";

type Props = {
  printers: PosSavedPrinter[];
  refreshing?: boolean;
  onRefresh: () => void;
  onSelect: (printer: PosSavedPrinter) => void;
};

export function PosAvailablePrintersBlock({
  printers,
  refreshing,
  onRefresh,
  onSelect,
}: Props) {
  const { t } = useAppTranslation();

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">
          {t(POS_SETTINGS_I18N.printerAvailable, "Available Printers")}
        </h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 border-primary px-3 text-primary"
          disabled={refreshing}
          onClick={onRefresh}
        >
          {t(POS_SETTINGS_I18N.printerRefresh, "Refresh")}
        </Button>
      </div>

      <div className="rounded-md border border-slate-200 bg-white px-3">
        {printers.length === 0 ? (
          <div className="space-y-1 py-6 text-center">
            <p className="text-sm text-slate-500">
              {t(
                POS_SETTINGS_I18N.printerEmpty,
                "No printers yet. Tap Refresh to scan for Bluetooth devices.",
              )}
            </p>
            <p className="text-xs text-slate-400">
              {t(
                POS_SETTINGS_I18N.printerNoReceiptPrinterHint,
                "Open Settings → Printer, tap Refresh, pick your Bluetooth printer, then Save with Receipt/Bill on.",
              )}
            </p>
          </div>
        ) : (
          printers.map((p) => (
            <PosPrinterListRow key={p.id} printer={p} onClick={() => onSelect(p)} />
          ))
        )}
      </div>
    </section>
  );
}
