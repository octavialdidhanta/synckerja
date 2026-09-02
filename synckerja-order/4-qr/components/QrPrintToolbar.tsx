import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { Loader2, Printer, Save } from "lucide-react";

type Props = {
  selectedCount: number;
  totalCount: number;
  onSave: () => void;
  onPrintSelected: () => void;
  onPrintAll: () => void;
  saveBusy?: boolean;
  disabled?: boolean;
};

export function QrPrintToolbar({
  selectedCount,
  totalCount,
  onSave,
  onPrintSelected,
  onPrintAll,
  saveBusy,
  disabled,
}: Props) {
  const { t } = useAppTranslation();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 print:hidden">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          {t("synckerjaOrder.qr.toolbar.title", "Table QR codes")}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t(
            "synckerjaOrder.qr.toolbar.subtitle",
            "Customize your table cards and print one QR per page.",
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={disabled || saveBusy} onClick={onSave}>
          {saveBusy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          {t("synckerjaOrder.qr.toolbar.save", "Save")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || selectedCount === 0}
          onClick={onPrintSelected}
        >
          <Printer className="mr-1.5 h-4 w-4" />
          {t("synckerjaOrder.qr.toolbar.printSelected", "Print selected ({{count}})", {
            count: selectedCount,
          })}
        </Button>
        <Button type="button" size="sm" disabled={disabled || totalCount === 0} onClick={onPrintAll}>
          <Printer className="mr-1.5 h-4 w-4" />
          {t("synckerjaOrder.qr.toolbar.printAll", "Print all")}
        </Button>
      </div>
    </div>
  );
}
