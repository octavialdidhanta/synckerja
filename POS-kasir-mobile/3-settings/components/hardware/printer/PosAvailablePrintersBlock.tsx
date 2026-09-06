import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
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
    <section className="mb-4">
      <div className="mb-1.5 flex items-center justify-between gap-2 px-0.5">
        <h3 className={cn(POS_PANEL.sectionTitle, "pb-0 pt-0 first:pt-0")}>
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

      <div className={POS_PANEL.card}>
        {printers.length === 0 ? (
          <div className="space-y-1 px-3 py-6 text-center">
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
