import { useMemo, useRef, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
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
import type { PosTable } from "@/8-2-9-table-management/lib/posTableTypes";
import type { PosTableSession } from "@/8-2-9-table-management/lib/posTableSessionTypes";
import type { TableOccupancy } from "@/8-2-9-table-management/sessions";
import { usePosCashierIsPhoneLayout } from "@/pos-mobile/2-cashier/hooks/usePosCashierIsPhoneLayout";
import {
  POS_PANEL,
  POS_SHEET_MOTION,
  POS_SHEET_OVERLAY_MOTION,
} from "@/pos-mobile/shared/lib/posPanelChrome";
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

type Snap = {
  table: PosTable;
  groupName: string;
  occupancy: TableOccupancy;
  billRows?: PosBillListRow[];
};

/** Pick an open bill on a shared table — side sheet on phone, dialog on tablet. */
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
  const snapRef = useRef<Snap | null>(null);

  // Keep last payload while Sheet/Dialog plays exit animation (parent clears table on close).
  if (open && table && occupancy) {
    snapRef.current = { table, groupName, occupancy, billRows };
  }
  const snap = snapRef.current;

  const tableRows = useMemo((): PosBillListRow[] => {
    if (!snap) return [];
    const byId = new Map((snap.billRows ?? []).map((r) => [r.session.id, r]));
    return snap.occupancy.openSessions.map((session) => {
      const enriched = byId.get(session.id);
      if (enriched) return enriched;
      return {
        session,
        groupName: snap.groupName || "—",
        waiterName: "—",
      };
    });
  }, [snap]);

  if (!snap) return null;

  const { table: snapTable, groupName: snapGroup, occupancy: snapOcc } = snap;
  const canNew = snapOcc.remainingPax >= 1;
  const title = `${snapTable.name}${snapGroup ? ` — ${snapGroup}` : ""}`;

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
          aria-label={t(POS_SELECT_TABLE_I18N.cancel, "Back")}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="min-w-0 shrink truncate">{titleNode}</div>
          <span className="inline-flex shrink-0 items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-600">
            {t(POS_SELECT_TABLE_I18N.sharedCapacity, "{{used}}/{{cap}} pax used", {
              used: snapOcc.usedPax,
              cap: snapOcc.capacity,
            })}
          </span>
          <span className="inline-flex shrink-0 items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-600">
            {t(POS_SELECT_TABLE_I18N.sharedBills, "{{count}} open bill(s)", {
              count: snapOcc.openSessions.length,
            })}
          </span>
        </div>
      </div>
    </div>
  );

  const body = (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-100">
      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain-xy min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className={POS_PANEL.body}>
          <p className={POS_PANEL.sectionTitle}>
            {t(POS_SELECT_TABLE_I18N.pickBill, "Open bills")}
          </p>
          <div className={cn(POS_PANEL.card, "w-max min-w-full overflow-visible")}>
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
        </div>
      </div>

      <div className="flex-shrink-0 border-t border-slate-200 bg-white">
        <div className="px-2 pt-3 pb-3 sm:px-2.5">
          {canNew ? (
            <Button type="button" className="h-11 w-full" onClick={onNewBill}>
              {t(POS_SELECT_TABLE_I18N.newBillOnTable, "New bill on this table")}
              <span className="ml-1 text-xs font-normal opacity-80">
                ({t(POS_SELECT_TABLE_I18N.remainingPax, "{{count}} seats left", {
                  count: snapOcc.remainingPax,
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
    </div>
  );

  if (isPhone) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="left"
          overlayClassName={POS_SHEET_OVERLAY_MOTION}
          className={cn(
            "z-[70] flex h-[100dvh] w-full max-w-none flex-col gap-0 border-0 bg-slate-100 p-0 sm:max-w-none",
            POS_SHEET_MOTION,
            "[&>button]:hidden",
          )}
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(78dvh,640px)] w-[min(92vw,860px)] max-w-none flex-col gap-0 overflow-hidden rounded-lg border border-slate-200/80 bg-slate-100 p-0 shadow-sm ease-in-out data-[state=open]:duration-150 data-[state=closed]:duration-150 [&>button]:hidden"
        aria-describedby={undefined}
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
