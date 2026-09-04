import { ListOrdered, ScanBarcode, UserPlus } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { POS_CASHIER_I18N } from "../../lib/posCashierCopy";
import type { PosCashierPhonePane } from "../../lib/posCashierPhoneLayout";

type Props = {
  pane: PosCashierPhonePane;
  onPaneChange: (pane: PosCashierPhonePane) => void;
  billItemCount: number;
  customerLabel: string | null;
  onOpenBillList: () => void;
  onAddCustomer: () => void;
  onOpenCameraScan?: () => void;
};

const btnHeight = "h-9";

/**
 * Phone toolbar — same palette as tablet bill chrome (`bg-brand-blue-soft` + primary).
 */
export function PosCashierPhoneTopBar({
  pane,
  onPaneChange,
  billItemCount,
  customerLabel,
  onOpenBillList,
  onAddCustomer,
  onOpenCameraScan,
}: Props) {
  const { t } = useAppTranslation();
  const badge =
    billItemCount > 99 ? "99+" : billItemCount > 0 ? String(billItemCount) : null;
  const billListLabel = t(POS_CASHIER_I18N.billList, "Bill List");
  const addLabel = customerLabel || t(POS_CASHIER_I18N.addCustomer, "+ Add Customer");

  return (
    <div className="flex flex-shrink-0 items-center gap-2 border-b border-primary/10 bg-brand-blue-soft px-2.5 py-2">
      <div
        className={cn(
          "grid min-w-[8.25rem] flex-none grid-cols-2 gap-0.5 rounded-lg bg-white/55 p-0.5 ring-1 ring-primary/10",
          btnHeight,
        )}
        role="tablist"
        aria-label={t(POS_CASHIER_I18N.phonePaneSwitchAria, "Menu or bill")}
      >
        <button
          type="button"
          role="tab"
          aria-selected={pane === "menu"}
          className={cn(
            "h-full rounded-md text-[11px] font-semibold leading-none transition-colors",
            pane === "menu"
              ? "bg-white text-primary shadow-sm"
              : "text-primary/65 hover:text-primary",
          )}
          onClick={() => onPaneChange("menu")}
        >
          {t(POS_CASHIER_I18N.phonePaneMenu, "Menu")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pane === "bill"}
          className={cn(
            "relative h-full rounded-md text-[11px] font-semibold leading-none transition-colors",
            pane === "bill"
              ? "bg-white text-primary shadow-sm"
              : "text-primary/65 hover:text-primary",
          )}
          onClick={() => onPaneChange("bill")}
        >
          {t(POS_CASHIER_I18N.phonePaneBill, "Bill")}
          {badge ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-white ring-2 ring-brand-blue-soft">
              {badge}
            </span>
          ) : null}
        </button>
      </div>

      <div className="h-5 w-px flex-shrink-0 bg-primary/15" aria-hidden />

      <button
        type="button"
        title={billListLabel}
        aria-label={billListLabel}
        className={cn(
          btnHeight,
          "inline-flex w-9 flex-shrink-0 flex-col items-center justify-center gap-0 rounded-md text-primary transition-colors hover:bg-primary/10 active:bg-primary/15",
        )}
        onClick={onOpenBillList}
      >
        <ListOrdered className="h-4 w-4" strokeWidth={2} />
      </button>

      {onOpenCameraScan ? (
        <button
          type="button"
          title={t(POS_CASHIER_I18N.scanOpenCamera, "Scan")}
          aria-label={t(POS_CASHIER_I18N.scanOpenCamera, "Scan")}
          className={cn(
            btnHeight,
            "inline-flex w-9 flex-shrink-0 flex-col items-center justify-center gap-0 rounded-md text-primary transition-colors hover:bg-primary/10 active:bg-primary/15",
          )}
          onClick={onOpenCameraScan}
        >
          <ScanBarcode className="h-4 w-4" strokeWidth={2} />
        </button>
      ) : null}

      <button
        type="button"
        title={addLabel}
        aria-label={addLabel}
        onClick={onAddCustomer}
        className={cn(
          btnHeight,
          "inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md bg-white px-3 text-[11px] font-semibold text-primary shadow-sm transition-colors hover:bg-primary hover:text-primary-foreground active:bg-primary/90",
        )}
      >
        <UserPlus className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={2.25} />
        <span className="truncate">{addLabel}</span>
      </button>
    </div>
  );
}
