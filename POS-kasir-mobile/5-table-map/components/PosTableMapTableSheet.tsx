import { DoorOpen, FileText, Printer, Trash2, X } from "lucide-react";
import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/shared/components/ui/drawer";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatStoreCheckoutRp } from "@/5-2-customer-visits/checkout/lib/catalogLabel";
import { sumCustomerVisitCart } from "@/5-2-customer-visits/checkout/lib/sumCustomerVisitCart";
import type { PosTable } from "@/8-2-9-table-management/lib/posTableTypes";
import type { PosTableSession } from "@/8-2-9-table-management/lib/posTableSessionTypes";
import { isPaidSeatingSession } from "@/pos-mobile/2-cashier/lib/pay-first-seating";
import { usePosCashierIsPhoneLayout } from "@/pos-mobile/2-cashier/hooks/usePosCashierIsPhoneLayout";
import { PosSafeAreaTopSpacer } from "@/pos-mobile/shared/layout/PosSafeAreaTopSpacer";
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

/** Table actions — fullscreen drawer on phone (fast ease-in-out), dialog on tablet. */
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
  const isPhone = usePosCashierIsPhoneLayout();
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

  const header = (titleNode: ReactNode) => (
    <div className="relative flex-shrink-0 border-b border-slate-200 bg-slate-50 px-4 py-3 text-center">
      <button
        type="button"
        onClick={() => onOpenChange(false)}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-200/80 hover:text-slate-700"
        aria-label={t(POS_TABLE_MAP_I18N.sheetClose, "Close")}
      >
        <X className="h-5 w-5" />
      </button>
      <div className="min-w-0 px-8">
        {titleNode}
        {occupied && session ? (
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {duration}
            {paidSeating ? null : (
              <>
                <span className="mx-1 text-slate-300">·</span>
                {formatStoreCheckoutRp(cartTotal)}
              </>
            )}
            <span className="mx-1 text-slate-300">·</span>
            {t(POS_TABLE_MAP_I18N.sheetPax, "{{count}} pax", { count: pax })}
          </p>
        ) : (
          <p className="mt-0.5 truncate text-xs text-slate-500">
            <span className="font-medium text-emerald-700">
              {t(POS_TABLE_MAP_I18N.vacant, "Vacant")}
            </span>
            <span className="mx-1 text-slate-300">·</span>
            {t(POS_TABLE_MAP_I18N.sheetPax, "{{count}} pax", { count: pax })}
          </p>
        )}
      </div>
    </div>
  );

  const body =
    occupied && paidSeating ? (
      <div className="flex min-h-0 flex-1 flex-col divide-y divide-slate-100 overflow-y-auto">
        <ActionRow
          icon={<DoorOpen className="h-5 w-5" />}
          label={t(POS_TABLE_MAP_I18N.sheetClearTable, "Clear table")}
          onClick={() => onClearTable?.()}
          disabled={busy}
        />
      </div>
    ) : occupied ? (
      <div className="flex min-h-0 flex-1 flex-col divide-y divide-slate-100 overflow-y-auto">
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
      <div className="flex min-h-0 flex-1 flex-col p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button
          type="button"
          className="h-11 w-full"
          onClick={onCreateOrder}
          disabled={busy}
        >
          {t(POS_TABLE_MAP_I18N.sheetCreateOrder, "Create Order")}
        </Button>
      </div>
    );

  if (isPhone) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} dismissible={!busy}>
        <DrawerContent
          aboveAppNav={false}
          smoothFast
          className="z-[70] flex h-[100dvh] max-h-[100dvh] flex-col gap-0 overflow-hidden rounded-none border-0 p-0 shadow-2xl [&>div:first-child]:hidden"
          overlayClassName="z-[70]"
        >
          <PosSafeAreaTopSpacer />
          {header(
            <DrawerTitle className="min-w-0 truncate text-base font-semibold leading-snug text-slate-900">
              {title}
            </DrawerTitle>,
          )}
          {body}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-sm gap-0 overflow-hidden rounded-xl border-0 p-0 shadow-xl [&>button]:hidden"
        aria-describedby={undefined}
      >
        {header(
          <DialogTitle className="truncate text-base font-semibold leading-snug text-slate-900">
            {title}
          </DialogTitle>,
        )}
        {body}
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
