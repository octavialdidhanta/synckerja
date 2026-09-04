import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { POS_SETTINGS_I18N } from "../../../lib/posSettingsCopy";
import { POS_PRINTER_ROLE_LABELS } from "../../../lib/printer/posPrinterRoleLabels";
import type { PosPrinterRole, PosSavedPrinter } from "../../../lib/printer/posPrinterTypes";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  printer: PosSavedPrinter | null;
  onSave: (printer: PosSavedPrinter) => void;
  onOpenCategories: () => void;
  onTestPrint?: (printer: PosSavedPrinter) => void | Promise<void>;
  testPrinting?: boolean;
};

export function PosPrinterEditSheet({
  open,
  onOpenChange,
  printer,
  onSave,
  onOpenCategories,
  onTestPrint,
  testPrinting,
}: Props) {
  const { t } = useAppTranslation();
  const [draft, setDraft] = useState<PosSavedPrinter | null>(null);

  useEffect(() => {
    if (open && printer) setDraft({ ...printer, roles: { ...printer.roles } });
  }, [open, printer]);

  if (!draft) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="p-0 sm:max-w-md" />
      </Sheet>
    );
  }

  const setRole = (role: PosPrinterRole, value: boolean) => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            roles: {
              ...prev.roles,
              [role]: role === "sticker_label" ? false : value,
            },
          }
        : prev,
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader className="flex flex-row items-center gap-2 space-y-0 border-b px-3 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-primary text-primary"
            onClick={() => onOpenChange(false)}
          >
            {t(POS_SETTINGS_I18N.printerCancel, "Cancel")}
          </Button>
          <SheetTitle className="flex-1 text-center text-base">
            {t(POS_SETTINGS_I18N.printerTitle, "Printer")}
          </SheetTitle>
          <Button
            type="button"
            size="sm"
            className="bg-primary text-primary-foreground"
            onClick={() => {
              onSave(draft);
              onOpenChange(false);
            }}
          >
            {t(POS_SETTINGS_I18N.printerSave, "Save")}
          </Button>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-3">
            <span className="text-sm text-slate-900">
              {t(POS_SETTINGS_I18N.printerNickname, "Nickname")}
            </span>
            <Input
              value={draft.nickname}
              placeholder={t(POS_SETTINGS_I18N.printerNickname, "Nickname")}
              onChange={(e) => setDraft({ ...draft, nickname: e.target.value })}
              className="h-9 max-w-[55%] border-0 bg-transparent text-right shadow-none focus-visible:ring-0"
            />
          </div>

          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-900">
            {t(POS_SETTINGS_I18N.printerPrintFromDevice, "PRINT FROM THIS ANDROID")}
          </p>

          <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
            {(["receipt_bill", "order_ticket"] as const).map((role) => {
              const meta = POS_PRINTER_ROLE_LABELS[role];
              return (
                <div
                  key={role}
                  className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5"
                >
                  <span className="text-sm text-slate-900">
                    {t(meta.key, meta.fallback)}
                  </span>
                  <Switch
                    checked={draft.roles[role]}
                    onCheckedChange={(v) => setRole(role, v)}
                  />
                </div>
              );
            })}

            <div className="border-b border-slate-100 px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 text-sm text-slate-900">
                    {t(POS_SETTINGS_I18N.printerRoleSticker, "Sticker Label")}
                    <ExternalLink className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    {t(
                      POS_SETTINGS_I18N.printerStickerHint,
                      "Print each product separately. Only for • EPSON TM-T82 • TSP-650 II",
                    )}
                  </p>
                </div>
                <span className="text-xs text-slate-400">
                  {t(POS_SETTINGS_I18N.printerNotAvailable, "Not Available")}
                </span>
              </div>
            </div>

            {(["queue_number", "shift_recap"] as const).map((role) => {
              const meta = POS_PRINTER_ROLE_LABELS[role];
              return (
                <div
                  key={role}
                  className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 last:border-b-0"
                >
                  <span className="text-sm text-slate-900">
                    {t(meta.key, meta.fallback)}
                  </span>
                  <Switch
                    checked={draft.roles[role]}
                    onCheckedChange={(v) => setRole(role, v)}
                  />
                </div>
              );
            })}
          </div>

          {draft.roles.order_ticket ? (
            <button
              type="button"
              onClick={onOpenCategories}
              className="mt-4 w-full rounded-md border border-slate-200 px-4 py-3 text-left text-sm text-slate-900 hover:bg-slate-50"
            >
              {t(POS_SETTINGS_I18N.printerTicketCategories, "Categories on Order Ticket")}
            </button>
          ) : null}

          {onTestPrint ? (
            <Button
              type="button"
              variant="outline"
              className="mt-4 h-11 w-full border-primary text-primary"
              disabled={testPrinting}
              onClick={() => void onTestPrint(draft)}
            >
              {t(POS_SETTINGS_I18N.printerTestPrint, "Test Print")}
            </Button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
