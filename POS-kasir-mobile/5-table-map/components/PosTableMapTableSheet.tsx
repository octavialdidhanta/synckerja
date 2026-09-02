import { DoorOpen, FileText, Printer, Trash2, X } from "lucide-react";
import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatStoreCheckoutRp } from "@/5-2-customer-visits/checkout/lib/catalogLabel";
import { sumCustomerVisitCart } from "@/5-2-customer-visits/checkout/lib/sumCustomerVisitCart";
import type { PosTable } from "@/8-2-9-table-management/lib/posTableTypes";
import type { PosTableSession } from "@/8-2-9-table-management/lib/posTableSessionTypes";
import { isPaidSeatingSession } from "@/pos-mobile/2-cashier/lib/pay-first-seating";
import { formatPosTableDuration } from "../lib/formatPosTableDuration";
import { POS_TABLE_MAP_I18N } from "../lib/posTableMapCopy";

export type PosTableMapSheetTarget = {
  table: PosTable;
  groupName: string;
  session: PosTableSession | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: PosTableMapSheetTarget | null;
  nowMs: number;
  onViewOrder: () => void;
  onCreateOrder: () => void;
  onPrintBill: () => void;
  onDeleteBill: () => void;
  onClearTable?: () => void;
  busy?: boolean;
};

export function PosTableMapTableSheet({
  open,
  onOpenChange,
  target,
  nowMs,
  onViewOrder,
  onCreateOrder,
  onPrintBill,
  onDeleteBill,
  onClearTable,
  busy,
}: Props) {
  const { t } = useAppTranslation();
  if (!target) return null;

  const { table, groupName, session } = target;
  const occupied = Boolean(session);
  const paidSeating = isPaidSeatingSession(session);
  const title = `${table.name} - ${groupName}`;
  const cartTotal = session
    ? sumCustomerVisitCart(session.cart_snapshot).total
    : 0;
  const duration = session ? formatPosTableDuration(session.seated_at, nowMs) : null;
  const pax = session?.pax ?? table.pax;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-sm gap-0 overflow-hidden rounded-xl border-0 p-0 shadow-xl [&>button]:hidden"
        aria-describedby={undefined}
      >
        <div className="relative border-b border-slate-100 px-4 pb-3 pt-4 text-center">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-3 top-3 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label={t(POS_TABLE_MAP_I18N.sheetClose, "Close")}
          >
            <X className="h-5 w-5" />
          </button>
          <DialogTitle className="pr-8 text-base font-semibold text-slate-900">{title}</DialogTitle>
          {occupied && session ? (
            <div className="mt-2 space-y-0.5 text-sm text-slate-600">
              <p>
                {duration}
                {paidSeating ? null : (
                  <>
                    <span className="mx-1.5 text-slate-300">·</span>
                    {formatStoreCheckoutRp(cartTotal)}
                  </>
                )}
              </p>
              <p className="text-xs text-slate-500">
                {t(POS_TABLE_MAP_I18N.sheetPax, "{{count}} pax", { count: pax })}
              </p>
            </div>
          ) : (
            <div className="mt-2 space-y-0.5 text-sm text-slate-600">
              <p className="font-medium text-emerald-700">
                {t(POS_TABLE_MAP_I18N.vacant, "Vacant")}
              </p>
              <p className="text-xs text-slate-500">
                {t(POS_TABLE_MAP_I18N.sheetPax, "{{count}} pax", { count: pax })}
              </p>
            </div>
          )}
        </div>

        {occupied && paidSeating ? (
          <div className="flex flex-col divide-y divide-slate-100">
            <ActionRow
              icon={<DoorOpen className="h-5 w-5" />}
              label={t(POS_TABLE_MAP_I18N.sheetClearTable, "Clear table")}
              onClick={() => onClearTable?.()}
              disabled={busy}
            />
          </div>
        ) : occupied ? (
          <div className="flex flex-col divide-y divide-slate-100">
            <ActionRow
              icon={<FileText className="h-5 w-5" />}
              label={t(POS_TABLE_MAP_I18N.sheetViewOrder, "View Order")}
              onClick={onViewOrder}
              disabled={busy}
            />
            <ActionRow
              icon={<Printer className="h-5 w-5" />}
              label={t(POS_TABLE_MAP_I18N.sheetPrintBill, "Print Bill")}
              onClick={onPrintBill}
              disabled={busy}
            />
            <ActionRow
              icon={<Trash2 className="h-5 w-5" />}
              label={t(POS_TABLE_MAP_I18N.sheetDeleteBill, "Delete Bill")}
              onClick={onDeleteBill}
              disabled={busy}
              danger
            />
          </div>
        ) : (
          <div className="p-4">
            <Button
              type="button"
              className="h-11 w-full"
              onClick={onCreateOrder}
              disabled={busy}
            >
              {t(POS_TABLE_MAP_I18N.sheetCreateOrder, "Create Order")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ActionRow({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-50"
    >
      <span className={danger ? "text-red-500" : "text-primary"}>{icon}</span>
      <span className={danger ? "text-red-600" : undefined}>{label}</span>
    </button>
  );
}
