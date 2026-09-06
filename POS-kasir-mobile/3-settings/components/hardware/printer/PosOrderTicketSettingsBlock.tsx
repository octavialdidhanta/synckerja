import { ChevronRight } from "lucide-react";
import { Switch } from "@/shared/components/ui/switch";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
import { POS_SETTINGS_I18N } from "../../../lib/posSettingsCopy";

type Props = {
  ticketCopies: number;
  printTicketOnPay: boolean;
  printTicketPerProduct: boolean;
  /** Bluetooth printers cannot use per-product mode. */
  perProductDisabled?: boolean;
  onOpenCopies: () => void;
  onPrintTicketOnPayChange: (value: boolean) => void;
  onPrintTicketPerProductChange: (value: boolean) => void;
  onOpenCategories?: () => void;
};

export function PosOrderTicketSettingsBlock({
  ticketCopies,
  printTicketOnPay,
  printTicketPerProduct,
  perProductDisabled,
  onOpenCopies,
  onPrintTicketOnPayChange,
  onPrintTicketPerProductChange,
  onOpenCategories,
}: Props) {
  const { t } = useAppTranslation();

  return (
    <section>
      <p className={POS_PANEL.sectionTitle}>
        {t(POS_SETTINGS_I18N.printerTicketSection, "ORDER TICKET")}
      </p>
      <div className={POS_PANEL.card}>
        <button
          type="button"
          onClick={onOpenCopies}
          className={cn(POS_PANEL.row, "text-left hover:bg-slate-50")}
        >
          <span className={POS_PANEL.rowLabel}>
            {t(POS_SETTINGS_I18N.printerTicketCopies, "Number of Order Tickets Printed")}
          </span>
          <span className="flex items-center gap-1 text-sm font-medium text-slate-700">
            {ticketCopies}
            <ChevronRight className="h-4 w-4 text-slate-300" aria-hidden />
          </span>
        </button>

        <div className={POS_PANEL.row}>
          <span className={POS_PANEL.rowLabel}>
            {t(POS_SETTINGS_I18N.printerTicketOnPay, "Print Order Ticket Upon Payment")}
          </span>
          <Switch checked={printTicketOnPay} onCheckedChange={onPrintTicketOnPayChange} />
        </div>

        <div className={cn(POS_PANEL.row, "items-start")}>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-900">
              {t(POS_SETTINGS_I18N.printerTicketPerProduct, "Print Order Ticket per Product")}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              {t(
                POS_SETTINGS_I18N.printerTicketPerProductHint,
                "Only for • EPSON TM-T82 • TSP-650 II",
              )}
            </p>
          </div>
          <Switch
            checked={printTicketPerProduct && !perProductDisabled}
            disabled={perProductDisabled}
            onCheckedChange={onPrintTicketPerProductChange}
          />
        </div>

        {onOpenCategories ? (
          <button
            type="button"
            onClick={onOpenCategories}
            className={cn(POS_PANEL.row, "text-left hover:bg-slate-50")}
          >
            <span className={POS_PANEL.rowLabel}>
              {t(POS_SETTINGS_I18N.printerTicketCategories, "Categories on Order Ticket")}
            </span>
            <ChevronRight className="h-4 w-4 text-slate-300" aria-hidden />
          </button>
        ) : null}
      </div>
    </section>
  );
}
