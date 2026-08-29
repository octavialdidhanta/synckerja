import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatStoreCheckoutRp } from "@/5-2-customer-visits/checkout/lib/catalogLabel";
import { sumCustomerVisitCart } from "@/5-2-customer-visits/checkout/lib/sumCustomerVisitCart";
import type { PosTableSession } from "@/8-2-9-table-management/lib/posTableSessionTypes";
import { formatPosTableDuration } from "../lib/formatPosTableDuration";
import { POS_TABLE_MAP_I18N } from "../lib/posTableMapCopy";

export type PosTableMapBillListItem = {
  session: PosTableSession;
  groupName: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PosTableMapBillListItem[];
  nowMs: number;
  onSelect: (item: PosTableMapBillListItem) => void;
};

/** Lists open (occupied) table bills for the outlet. */
export function PosTableMapBillListSheet({
  open,
  onOpenChange,
  items,
  nowMs,
  onSelect,
}: Props) {
  const { t } = useAppTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md gap-0 overflow-hidden rounded-xl border-0 p-0 shadow-xl [&>button]:hidden"
        aria-describedby={undefined}
      >
        <div className="relative border-b border-slate-100 px-4 py-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-3 top-3 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label={t(POS_TABLE_MAP_I18N.sheetClose, "Close")}
          >
            <X className="h-5 w-5" />
          </button>
          <DialogTitle className="pr-8 text-base font-semibold text-slate-900">
            {t(POS_TABLE_MAP_I18N.billListTitle, "Bill List")}
          </DialogTitle>
          <p className="mt-0.5 text-xs text-slate-500">
            {t(POS_TABLE_MAP_I18N.billListSubtitle, "{{count}} occupied tables", {
              count: items.length,
            })}
          </p>
        </div>

        <div className="max-h-[min(60vh,420px)] overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-400">
              {t(POS_TABLE_MAP_I18N.billListEmpty, "No open bills yet.")}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((item) => {
                const total = sumCustomerVisitCart(item.session.cart_snapshot).total;
                const duration = formatPosTableDuration(item.session.seated_at, nowMs);
                return (
                  <li key={item.session.id}>
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-orange-50/60"
                      onClick={() => onSelect(item)}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {item.session.table_name}
                          <span className="font-normal text-slate-500">
                            {" "}
                            · {item.groupName}
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs text-orange-700">
                          {duration}
                          <span className="mx-1 text-slate-300">·</span>
                          {t(POS_TABLE_MAP_I18N.sheetPax, "{{count}} pax", {
                            count: item.session.pax,
                          })}
                        </p>
                      </div>
                      <p className="flex-shrink-0 text-sm font-semibold tabular-nums text-slate-800">
                        {formatStoreCheckoutRp(total)}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
