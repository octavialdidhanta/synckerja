import type { ReactNode } from "react";
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
  leading?: ReactNode;
};

export function QrPrintToolbar({
  selectedCount,
  totalCount,
  onSave,
  onPrintSelected,
  onPrintAll,
  saveBusy,
  disabled,
  leading,
}: Props) {
  const { t } = useAppTranslation();

  const actions = (
    <>
      <div className="min-w-0">
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
      <div className="flex flex-wrap items-center justify-end gap-2">
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
    </>
  );

  if (leading) {
    return (
      <div className="grid grid-cols-1 items-stretch gap-0 border-b border-border lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] print:hidden">
        <div className="flex min-w-0 items-end border-b border-border p-4 lg:border-b-0 lg:border-r">{leading}</div>
        <div className="flex min-w-0 items-center justify-between gap-2 p-4">{actions}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 print:hidden">
      {actions}
    </div>
  );
}
