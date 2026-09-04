import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { POS_CASHIER_I18N } from "../../lib/posCashierCopy";
import type { PosCashierPhonePane } from "../../lib/posCashierPhoneLayout";

type Props = {
  pane: PosCashierPhonePane;
  onPaneChange: (pane: PosCashierPhonePane) => void;
  /** Total line quantities for Bill badge (0 hides badge). */
  billItemCount: number;
};

export function PosCashierPhonePaneSwitch({ pane, onPaneChange, billItemCount }: Props) {
  const { t } = useAppTranslation();
  const badge =
    billItemCount > 99 ? "99+" : billItemCount > 0 ? String(billItemCount) : null;

  return (
    <div className="flex-shrink-0 border-b border-slate-200 bg-white px-3 py-2">
      <div
        className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1"
        role="tablist"
        aria-label={t(POS_CASHIER_I18N.phonePaneSwitchAria, "Menu or bill")}
      >
        <button
          type="button"
          role="tab"
          aria-selected={pane === "menu"}
          className={cn(
            "rounded-md px-3 py-2 text-sm font-semibold transition-colors",
            pane === "menu"
              ? "bg-white text-primary shadow-sm"
              : "text-slate-600 hover:text-slate-900",
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
            "relative rounded-md px-3 py-2 text-sm font-semibold transition-colors",
            pane === "bill"
              ? "bg-white text-primary shadow-sm"
              : "text-slate-600 hover:text-slate-900",
          )}
          onClick={() => onPaneChange("bill")}
        >
          {t(POS_CASHIER_I18N.phonePaneBill, "Bill")}
          {badge ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-white">
              {badge}
            </span>
          ) : null}
        </button>
      </div>
    </div>
  );
}
