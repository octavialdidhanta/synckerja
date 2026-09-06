import { ArrowLeft, DoorOpen, FileText, Printer, Trash2 } from "lucide-react";
import { useRef, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { formatStoreCheckoutRp } from "@/5-2-customer-visits/checkout/lib/catalogLabel";
import { sumCustomerVisitCart } from "@/5-2-customer-visits/checkout/lib/sumCustomerVisitCart";
import type { PosTable } from "@/8-2-9-table-management/lib/posTableTypes";
import type { PosTableSession } from "@/8-2-9-table-management/lib/posTableSessionTypes";
import { isPaidSeatingSession } from "@/pos-mobile/2-cashier/lib/pay-first-seating";
import { usePosCashierIsPhoneLayout } from "@/pos-mobile/2-cashier/hooks/usePosCashierIsPhoneLayout";
import {
  POS_PANEL,
  POS_SHEET_MOTION,
  POS_SHEET_OVERLAY_MOTION,
} from "@/pos-mobile/shared/lib/posPanelChrome";
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

/** Table actions — side sheet on phone, dialog on tablet. */
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
  const snapRef = useRef<PosTableMapSheetTarget | null>(null);
  if (open && target) snapRef.current = target;
  const snap = snapRef.current;
  if (!snap) return null;

  const { table, groupName, session } = snap;
  const occupied = Boolean(session);
  const paidSeating = isPaidSeatingSession(session);
  const title = `${table.name}${groupName ? ` — ${groupName}` : ""}`;
  const cartTotal = session
    ? sumCustomerVisitCart(session.cart_snapshot).total
    : 0;
  const duration = session ? formatPosTableDuration(session.seated_at, nowMs) : null;
  const pax = session?.pax ?? table.pax;

  const chipClass =
    "inline-flex shrink-0 items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-600";

  const header = (titleNode: ReactNode) => (
    <div
      className="flex-shrink-0 border-b border-slate-200 bg-white"
      style={{
        paddingTop:
          "max(0px, env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px))",
      }}
    >
      <div className={cn(POS_PANEL.header, "border-b-0")}>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className={POS_PANEL.headerBack}
          aria-label={t(POS_TABLE_MAP_I18N.sheetClose, "Back")}
          disabled={busy}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="min-w-0 shrink truncate">{titleNode}</div>
          {occupied && session ? (
            <>
              {duration ? (
                <span className={chipClass}>{duration}</span>
              ) : null}
              {paidSeating ? null : (
                <span className={chipClass}>{formatStoreCheckoutRp(cartTotal)}</span>
              )}
              <span className={chipClass}>
                {t(POS_TABLE_MAP_I18N.sheetPax, "{{count}} pax", { count: pax })}
              </span>
            </>
          ) : (
            <>
              <span
                className={cn(
                  chipClass,
                  "bg-emerald-50 font-semibold text-emerald-700",
                )}
              >
                {t(POS_TABLE_MAP_I18N.vacant, "Vacant")}
              </span>
              <span className={chipClass}>
                {t(POS_TABLE_MAP_I18N.sheetPax, "{{count}} pax", { count: pax })}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const body =
    occupied && paidSeating ? (
      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-100">
        <div className={POS_PANEL.body}>
          <div className={POS_PANEL.card}>
            <ActionRow
              icon={<DoorOpen className="h-5 w-5" />}
              label={t(POS_TABLE_MAP_I18N.sheetClearTable, "Clear table")}
              onClick={() => onClearTable?.()}
              disabled={busy}
            />
          </div>
        </div>
      </div>
    ) : occupied ? (
      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-100">
        <div className={POS_PANEL.body}>
          <div className={POS_PANEL.card}>
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
        </div>
      </div>
    ) : (
      <div className="min-h-0 flex-1 bg-slate-100">
        <div className={POS_PANEL.body}>
          <Button
            type="button"
            className="h-11 w-full"
            onClick={onCreateOrder}
            disabled={busy}
          >
            {t(POS_TABLE_MAP_I18N.sheetCreateOrder, "Create Order")}
          </Button>
        </div>
      </div>
    );

  if (isPhone) {
    return (
      <Sheet open={open} onOpenChange={(next) => {
        if (busy && !next) return;
        onOpenChange(next);
      }}>
        <SheetContent
          side="left"
          overlayClassName={POS_SHEET_OVERLAY_MOTION}
          className={cn(
            "z-[70] flex h-[100dvh] w-full max-w-none flex-col gap-0 border-0 bg-slate-100 p-0 sm:max-w-none",
            POS_SHEET_MOTION,
            "[&>button]:hidden",
          )}
          onInteractOutside={(e) => {
            if (busy) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (busy) e.preventDefault();
          }}
        >
          {header(
            <SheetTitle className="truncate text-left text-base font-semibold leading-none text-slate-900">
              {title}
            </SheetTitle>,
          )}
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (busy && !next) return;
      onOpenChange(next);
    }}>
      <DialogContent
        className="max-w-sm gap-0 overflow-hidden rounded-lg border border-slate-200/80 bg-slate-100 p-0 shadow-sm ease-in-out data-[state=open]:duration-150 data-[state=closed]:duration-150 [&>button]:hidden"
        aria-describedby={undefined}
        onInteractOutside={(e) => {
          if (busy) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        {header(
          <DialogTitle className="truncate text-left text-base font-semibold leading-none text-slate-900">
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
      className={cn(
        POS_PANEL.row,
        "text-left text-sm font-medium transition-colors hover:bg-slate-50 disabled:opacity-50",
        danger ? "text-red-600" : "text-slate-800",
      )}
    >
      <span className={cn("flex-shrink-0", danger ? "text-red-500" : "text-primary")}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">{label}</span>
    </button>
  );
}
