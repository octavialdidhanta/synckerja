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
    <div className="flex-shrink-0 border-b border-slate-200/80 bg-white px-4 pb-3.5 pt-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {titleNode}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-600">
              {t(POS_SELECT_TABLE_I18N.sharedCapacity, "{{used}}/{{cap}} pax used", {
                used: occupancy.usedPax,
                cap: occupancy.capacity,
              })}
            </span>
            <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-medium tabular-nums text-sky-700">
              {t(POS_SELECT_TABLE_I18N.sharedBills, "{{count}} open bill(s)", {
                count: occupancy.openSessions.length,
              })}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="-mr-1 -mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          aria-label={t(POS_SELECT_TABLE_I18N.cancel, "Cancel")}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );

  const body = (
    <>
      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <p className="px-4 pb-1.5 pt-3.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
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

      <div className="flex-shrink-0 border-t border-slate-200/80 bg-white">
        <div className="px-4 pt-3 pb-3">
          {canNew ? (
            <Button type="button" className="h-11 w-full" onClick={onNewBill}>
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
        {isPhone ? (
          <div
            aria-hidden
            className="flex-shrink-0"
            style={{
              height:
                "max(1rem, env(safe-area-inset-bottom, 0px), var(--footer-bottom-inset, 0px))",
            }}
          />
        ) : null}
      </div>
    </>
  );

  if (isPhone) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} dismissible>
        <DrawerContent
          aboveAppNav={false}
          smoothFast
          className="z-[70] flex h-[100dvh] max-h-[100dvh] flex-col gap-0 overflow-hidden rounded-none border-0 bg-white p-0 shadow-2xl [&>div:first-child]:hidden"
          overlayClassName="z-[70]"
        >
          <PosSafeAreaTopSpacer />
          {header(
            <DrawerTitle className="min-w-0 truncate text-left text-[17px] font-semibold leading-snug tracking-tight text-slate-900">
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
        className="flex max-h-[min(78dvh,640px)] w-[min(92vw,860px)] max-w-none flex-col gap-0 overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-2xl [&>button]:hidden"
        aria-describedby={undefined}
      >
        {header(
          <DialogTitle className="min-w-0 truncate text-left text-lg font-semibold leading-snug tracking-tight text-slate-900">
            {title}
          </DialogTitle>,
        )}
        {body}
      </DialogContent>
    </Dialog>
  );
}
