import { useEffect, useState, type ReactNode } from "react";
import { User } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
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
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { usePosCashierIsPhoneLayout } from "../../hooks/usePosCashierIsPhoneLayout";
import { POS_NEW_BILL_I18N } from "../../lib/posNewBillCopy";
import type { PosShiftWaiterCandidate } from "../../hooks/usePosShiftWaiterCandidate";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableLabel: string;
  groupLabel: string;
  defaultPax: number;
  /** Soft capacity remaining on the table for this new bill. */
  maxPax?: number;
  waiter: PosShiftWaiterCandidate | null;
  waiterLoading?: boolean;
  confirming?: boolean;
  onConfirm: (args: { pax: number; waiterId: string }) => void;
};

/** New Bill — bottom drawer on phone, dialog on tablet. */
export function PosNewBillDialog({
  open,
  onOpenChange,
  tableLabel,
  groupLabel,
  defaultPax,
  maxPax = 20,
  waiter,
  waiterLoading,
  confirming,
  onConfirm,
}: Props) {
  const { t } = useAppTranslation();
  const isPhone = usePosCashierIsPhoneLayout();
  const paxCeiling = Math.min(20, Math.max(1, Math.floor(maxPax) || 1));
  const [pax, setPax] = useState(
    Math.min(paxCeiling, Math.max(1, defaultPax || 1)),
  );
  const [selectedWaiterId, setSelectedWaiterId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const ceiling = Math.min(20, Math.max(1, Math.floor(maxPax) || 1));
    setPax(Math.min(ceiling, Math.max(1, defaultPax || 1)));
    setSelectedWaiterId(waiter?.userId ?? null);
  }, [open, defaultPax, maxPax, waiter?.userId]);

  const canConfirm = Boolean(selectedWaiterId) && !confirming && !waiterLoading;
  const subtitle = `${tableLabel}${groupLabel ? ` - ${groupLabel}` : ""}`;

  const header = (titleNode: ReactNode) => (
    <div className="relative flex items-center justify-center border-b border-slate-100 px-3 py-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="absolute left-3 top-1/2 -translate-y-1/2 border-primary text-primary"
        onClick={() => onOpenChange(false)}
        disabled={confirming}
      >
        {t(POS_NEW_BILL_I18N.cancel, "Cancel")}
      </Button>
      <div className="min-w-0 px-20 text-center">
        {titleNode}
        <p className="truncate text-xs text-slate-500">{subtitle}</p>
      </div>
      <Button
        type="button"
        size="sm"
        className="absolute right-3 top-1/2 -translate-y-1/2"
        disabled={!canConfirm}
        onClick={() => {
          if (!selectedWaiterId) return;
          onConfirm({ pax, waiterId: selectedWaiterId });
        }}
      >
        {t(POS_NEW_BILL_I18N.confirm, "Confirm")}
      </Button>
    </div>
  );

  const body = (
    <>
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <span className="text-sm font-medium text-slate-800">
          {t(POS_NEW_BILL_I18N.pax, "Pax")}
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0"
            disabled={pax <= 1 || confirming}
            onClick={() => setPax((v) => Math.max(1, v - 1))}
          >
            −
          </Button>
          <span className="w-8 text-center text-sm font-semibold">{pax}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0"
            disabled={pax >= paxCeiling || confirming}
            onClick={() => setPax((v) => Math.min(paxCeiling, v + 1))}
          >
            +
          </Button>
        </div>
      </div>

      <div
        className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-2 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        data-vaul-no-drag=""
      >
        <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t(POS_NEW_BILL_I18N.chooseWaiter, "Choose waiter")}
        </p>
        {waiterLoading ? (
          <p className="px-2 py-6 text-center text-sm text-slate-400">…</p>
        ) : !waiter ? (
          <p className="px-2 py-6 text-center text-sm text-slate-400">
            {t(POS_NEW_BILL_I18N.noWaiter, "No waiter from the open shift.")}
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setSelectedWaiterId(waiter.userId)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors",
              selectedWaiterId === waiter.userId
                ? "bg-primary/10"
                : "hover:bg-slate-50",
            )}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-slate-600">
              <User className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-slate-900">
                {waiter.fullName}
              </span>
            </span>
            <span className="shrink-0 text-xs text-slate-500">{waiter.roleLabel}</span>
          </button>
        )}
      </div>
    </>
  );

  if (isPhone) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} dismissible={!confirming}>
        <DrawerContent
          aboveAppNav={false}
          smoothFast
          className="z-[90] flex max-h-[min(88dvh,640px)] flex-col gap-0 overflow-hidden rounded-t-2xl border-0 p-0 pb-[max(env(safe-area-inset-bottom,0px),0.5rem)] shadow-2xl"
          overlayClassName="z-[90]"
        >
          {header(
            <DrawerTitle className="text-base font-semibold">
              {t(POS_NEW_BILL_I18N.title, "New Bill")}
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
        className="flex max-h-[min(80dvh,560px)] w-[min(92vw,480px)] max-w-none flex-col gap-0 overflow-hidden rounded-xl border-0 p-0 shadow-xl [&>button]:hidden"
        aria-describedby={undefined}
      >
        {header(
          <DialogTitle className="text-base font-semibold">
            {t(POS_NEW_BILL_I18N.title, "New Bill")}
          </DialogTitle>,
        )}
        {body}
      </DialogContent>
    </Dialog>
  );
}
