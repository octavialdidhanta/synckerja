import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
import { usePosCashierIsPhoneLayout } from "@/pos-mobile/2-cashier/hooks/usePosCashierIsPhoneLayout";
import { POS_SETTINGS_I18N } from "../../../lib/posSettingsCopy";
import { POS_PRINTER_ROLE_LABELS } from "../../../lib/printer/posPrinterRoleLabels";
import type { PosPrinterRole, PosSavedPrinter } from "../../../lib/printer/posPrinterTypes";
import { PosPrinterPageChrome } from "./PosPrinterPageChrome";

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
  const isPhone = usePosCashierIsPhoneLayout();
  const [draft, setDraft] = useState<PosSavedPrinter | null>(null);

  useEffect(() => {
    if (open && printer) setDraft({ ...printer, roles: { ...printer.roles } });
  }, [open, printer]);

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

  const close = () => onOpenChange(false);
  const title = t(POS_SETTINGS_I18N.printerTitle, "Printer");

  if (!open || !draft) return null;

  return (
    <PosPrinterPageChrome
      open={open}
      onOpenChange={onOpenChange}
      title={title}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-100">
        <div className="flex-shrink-0 border-b border-slate-200 bg-white">
          <div
            className={cn(
              POS_PANEL.header,
              "flex-row items-center gap-1 space-y-0 border-b-0 px-1 text-left",
            )}
          >
            <button
              type="button"
              onClick={close}
              className="inline-flex h-10 min-w-[4.25rem] flex-shrink-0 items-center justify-center rounded-md px-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-200/80"
            >
              {t(POS_SETTINGS_I18N.printerCancel, "Cancel")}
            </button>
            {isPhone ? (
              <h1 className={cn(POS_PANEL.headerTitle, "text-center leading-none")}>{title}</h1>
            ) : (
              <h2 className={cn(POS_PANEL.headerTitle, "text-center leading-none")}>{title}</h2>
            )}
            <button
              type="button"
              onClick={() => {
                onSave(draft);
                close();
              }}
              className="inline-flex h-10 min-w-[4.25rem] flex-shrink-0 items-center justify-center rounded-md px-2 text-sm font-semibold text-primary transition hover:bg-primary/10"
            >
              {t(POS_SETTINGS_I18N.printerSave, "Save")}
            </button>
          </div>
        </div>

        <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className={POS_PANEL.body}>
            <div className={cn(POS_PANEL.card, "mb-3")}>
              <div className={cn(POS_PANEL.row, "gap-3")}>
                <span className={POS_PANEL.rowLabel}>
                  {t(POS_SETTINGS_I18N.printerNickname, "Nickname")}
                </span>
                <Input
                  value={draft.nickname}
                  placeholder={t(POS_SETTINGS_I18N.printerNickname, "Nickname")}
                  onChange={(e) => setDraft({ ...draft, nickname: e.target.value })}
                  className="h-9 max-w-[55%] border-0 bg-transparent text-right shadow-none focus-visible:ring-0"
                />
              </div>
            </div>

            <p className={POS_PANEL.sectionTitle}>
              {t(POS_SETTINGS_I18N.printerPrintFromDevice, "PRINT FROM THIS ANDROID")}
            </p>

            <div className={POS_PANEL.card}>
              {(["receipt_bill", "order_ticket"] as const).map((role) => {
                const meta = POS_PRINTER_ROLE_LABELS[role];
                return (
                  <div key={role} className={POS_PANEL.row}>
                    <span className={POS_PANEL.rowLabel}>
                      {t(meta.key, meta.fallback)}
                    </span>
                    <Switch
                      checked={draft.roles[role]}
                      onCheckedChange={(v) => setRole(role, v)}
                    />
                  </div>
                );
              })}

              <div className={POS_PANEL.row}>
                <div className="min-w-0 flex-1 pr-2">
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
                <span className="shrink-0 text-xs text-slate-400">
                  {t(POS_SETTINGS_I18N.printerNotAvailable, "Not Available")}
                </span>
              </div>

              {(["queue_number", "shift_recap"] as const).map((role) => {
                const meta = POS_PRINTER_ROLE_LABELS[role];
                return (
                  <div key={role} className={POS_PANEL.row}>
                    <span className={POS_PANEL.rowLabel}>
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
                className={cn(
                  POS_PANEL.card,
                  "mt-3 flex w-full items-center px-3 py-3 text-left text-sm font-medium text-slate-900 hover:bg-slate-50",
                )}
              >
                {t(
                  POS_SETTINGS_I18N.printerTicketCategories,
                  "Categories on Order Ticket",
                )}
              </button>
            ) : null}

            {onTestPrint ? (
              <Button
                type="button"
                variant="outline"
                className="mt-3 h-11 w-full border-primary text-primary"
                disabled={testPrinting}
                onClick={() => void onTestPrint(draft)}
              >
                {t(POS_SETTINGS_I18N.printerTestPrint, "Test Print")}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </PosPrinterPageChrome>
  );
}
