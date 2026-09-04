import { useMemo, type ReactNode } from "react";
import { X } from "lucide-react";
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
import type { PosTable } from "@/8-2-9-table-management/lib/posTableTypes";
import type { PosTableSession } from "@/8-2-9-table-management/lib/posTableSessionTypes";
import type { TableOccupancy } from "@/8-2-9-table-management/sessions";
import { usePosCashierIsPhoneLayout } from "@/pos-mobile/2-cashier/hooks/usePosCashierIsPhoneLayout";
import { PosSafeAreaTopSpacer } from "@/pos-mobile/shared/layout/PosSafeAreaTopSpacer";
import { PosBillListSessionTable } from "../bill-list/PosBillListSessionTable";
import { POS_BILL_LIST_I18N } from "../../lib/posBillListCopy";
import type { PosBillListRow } from "../../hooks/usePosBillListSessions";
import { POS_SELECT_TABLE_I18N } from "../../lib/posSelectTableCopy";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: PosTable | null;
  groupName: string;
  occupancy: TableOccupancy | null;
  nowMs: number;
  /** Enriched open-bill rows (same source as Daftar Bill). Filtered to this table. */
  billRows?: PosBillListRow[];
  onResume: (session: PosTableSession) => void;
  onNewBill: () => void;
};

/** Pick an open bill on a shared table — fullscreen drawer on phone, dialog on tablet. */
export function PosSelectTableBillSheet({
  open,
  onOpenChange,
  table,
  groupName,
  occupancy,
  nowMs,
  billRows,
  onResume,
  onNewBill,
}: Props) {
  const { t } = useAppTranslation();
  const isPhone = usePosCashierIsPhoneLayout();

  const tableRows = useMemo((): PosBillListRow[] => {
    if (!table || !occupancy) return [];
    const byId = new Map((billRows ?? []).map((r) => [r.session.id, r]));
    return occupancy.openSessions.map((session) => {
      const enriched = byId.get(session.id);
      if (enriched) return enriched;
      return {
        session,
        groupName: groupName || "—",
        waiterName: "—",
      };
    });
  }, [billRows, groupName, occupancy, table]);

  if (!table || !occupancy) return null;

  const canNew = occupancy.remainingPax >= 1;
  const title = `${table.name}${groupName ? ` — ${groupName}` : ""}`;

  const header = (titleNode: ReactNode) => (
    <div className="relative flex-shrink-0 border-b border-slate-100 px-4 pb-3 pt-4 text-center">
      <button
        type="button"
        onClick={() => onOpenChange(false)}
        className="absolute right-3 top-3 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        aria-label={t(POS_SELECT_TABLE_I18N.cancel, "Cancel")}
      >
        <X className="h-5 w-5" />
      </button>
      {titleNode}
      <p className="mt-1 text-xs text-slate-500">
        {t(POS_SELECT_TABLE_I18N.sharedCapacity, "{{used}}/{{cap}} pax used", {
          used: occupancy.usedPax,
          cap: occupancy.capacity,
        })}
        <span className="mx-1.5 text-slate-300">·</span>
        {t(POS_SELECT_TABLE_I18N.sharedBills, "{{count}} open bill(s)", {
          count: occupancy.openSessions.length,
        })}
      </p>
    </div>
  );

  const body = (
    <>
      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {t(POS_SELECT_TABLE_I18N.pickBill, "Open bills")}
        </p>
        <PosBillListSessionTable
          rows={tableRows}
          query=""
          nowMs={nowMs}
          emptyKey={POS_BILL_LIST_I18N.emptyOpen}
          emptyFallback="No open bills yet."
          hideTableColumn
          onSelect={(row) => onResume(row.session)}
        />
      </div>

      <div className="flex-shrink-0 border-t border-slate-100 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {canNew ? (
          <Button type="button" className="w-full" onClick={onNewBill}>
            {t(POS_SELECT_TABLE_I18N.newBillOnTable, "New bill on this table")}
            <span className="ml-1 text-xs font-normal opacity-80">
              ({t(POS_SELECT_TABLE_I18N.remainingPax, "{{count}} seats left", {
                count: occupancy.remainingPax,
              })})
            </span>
          </Button>
        ) : (
          <p className="py-2 text-center text-xs text-slate-500">
            {t(POS_SELECT_TABLE_I18N.noCapacity, "No seats left on this table.")}
          </p>
        )}
      </div>
    </>
  );

  if (isPhone) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} dismissible>
        <DrawerContent
          aboveAppNav={false}
          smoothFast
          className="z-[70] flex h-[100dvh] max-h-[100dvh] flex-col gap-0 overflow-hidden rounded-none border-0 p-0 shadow-2xl [&>div:first-child]:hidden"
          overlayClassName="z-[70]"
        >
          <PosSafeAreaTopSpacer />
          {header(
            <DrawerTitle className="min-w-0 truncate pr-10 text-base font-semibold text-slate-900">
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
        className="flex max-h-[min(78dvh,640px)] w-[min(92vw,860px)] max-w-none flex-col gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-2xl [&>button]:hidden"
        aria-describedby={undefined}
      >
        {header(
          <DialogTitle className="pr-8 text-base font-semibold text-slate-900">
            {title}
          </DialogTitle>,
        )}
        {body}
      </DialogContent>
    </Dialog>
  );
}
