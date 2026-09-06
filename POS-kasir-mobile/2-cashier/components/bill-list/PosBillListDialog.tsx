import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
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
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import {
  POS_PANEL,
  POS_SHEET_MOTION,
  POS_SHEET_MOTION_MS,
  POS_SHEET_OVERLAY_MOTION,
} from "@/pos-mobile/shared/lib/posPanelChrome";
import {
  POS_BILL_LIST_I18N,
  type PosBillListTab,
} from "../../lib/posBillListCopy";
import type { PosBillListRow } from "../../hooks/usePosBillListSessions";
import type { PosLineVoid } from "../../hooks/usePosLineVoids";
import { usePosCashierIsPhoneLayout } from "../../hooks/usePosCashierIsPhoneLayout";
import { PosBillListSessionTable } from "./PosBillListSessionTable";
import { PosBillListProductVoidsPanel } from "./PosBillListProductVoidsPanel";
import { PosBillListRefundsPanel } from "./PosBillListRefundsPanel";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: PosBillListTab;
  openRows: PosBillListRow[];
  cancelledRows: PosBillListRow[];
  paidRows?: PosBillListRow[];
  voids: PosLineVoid[];
  nowMs: number;
  refundBusyId?: string | null;
  onNewBill: () => void;
  onSelectOpen: (row: PosBillListRow) => void;
  onCancelOpen: (row: PosBillListRow) => void;
  onFulfillOpen?: (row: PosBillListRow) => void;
  onRefundPaid?: (row: PosBillListRow) => void;
  showFulfillAction?: boolean;
};

export function PosBillListDialog({
  open,
  onOpenChange,
  initialTab = "open",
  openRows,
  cancelledRows,
  paidRows = [],
  voids,
  nowMs,
  refundBusyId = null,
  onNewBill,
  onSelectOpen,
  onCancelOpen,
  onFulfillOpen,
  onRefundPaid,
  showFulfillAction,
}: Props) {
  const { t } = useAppTranslation();
  const isPhone = usePosCashierIsPhoneLayout();
  const [tab, setTab] = useState<PosBillListTab>(initialTab);
  const [query, setQuery] = useState("");
  const newBillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setQuery("");
    }
  }, [open, initialTab]);

  useEffect(() => {
    return () => {
      if (newBillTimerRef.current != null) {
        clearTimeout(newBillTimerRef.current);
        newBillTimerRef.current = null;
      }
    };
  }, []);

  const searchPlaceholder =
    tab === "open"
      ? t(POS_BILL_LIST_I18N.searchOpen, "Search Open Bill")
      : tab === "cancelled"
        ? t(POS_BILL_LIST_I18N.searchCancelled, "Search cancelled bills")
        : tab === "paid_refunds"
          ? t(POS_BILL_LIST_I18N.searchPaid, "Search paid bills")
          : t(POS_BILL_LIST_I18N.searchVoids, "Search product cancellations");

  const tabs: { id: PosBillListTab; label: string }[] = [
    { id: "open", label: t(POS_BILL_LIST_I18N.tabOpen, "Open Bill") },
    { id: "cancelled", label: t(POS_BILL_LIST_I18N.tabCancelled, "Bill Cancellation") },
    {
      id: "product_voids",
      label: t(POS_BILL_LIST_I18N.tabProductVoids, "Product Cancellation"),
    },
    {
      id: "paid_refunds",
      label: t(POS_BILL_LIST_I18N.tabPaidRefunds, "Paid refunds"),
    },
  ];

  const titleText = t(POS_BILL_LIST_I18N.title, "Bill List");

  const handleNewBill = () => {
    if (newBillTimerRef.current != null) {
      clearTimeout(newBillTimerRef.current);
    }
    // Close with ease-in-out first, then run parent action (navigate / reset).
    onOpenChange(false);
    newBillTimerRef.current = setTimeout(() => {
      newBillTimerRef.current = null;
      onNewBill();
    }, POS_SHEET_MOTION_MS);
  };

  const header = (titleNode: ReactNode) => (
    <div
      className="flex-shrink-0 border-b border-slate-200 bg-white"
      style={{
        paddingTop:
          "max(0px, env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px))",
      }}
    >
      <div className={cn(POS_PANEL.header, "gap-1 border-b-0 pr-2")}>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className={POS_PANEL.headerBack}
          aria-label={t(POS_BILL_LIST_I18N.close, "Back")}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">{titleNode}</div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 border-slate-200 text-slate-800 hover:bg-slate-50"
          onClick={handleNewBill}
        >
          {t(POS_BILL_LIST_I18N.newBill, "New Bill")}
        </Button>
      </div>
    </div>
  );

  const body = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-100">
      <div className="scrollbar-hide flex flex-shrink-0 gap-2 overflow-x-auto border-b border-slate-200 bg-white px-2 py-2 sm:px-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTab(item.id);
              setQuery("");
            }}
            className={cn(
              "shrink-0 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm",
              tab === item.id
                ? "border-slate-800 bg-slate-800 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="relative flex-shrink-0 border-b border-slate-200 bg-white px-2 py-2 sm:px-2.5">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-10 border-slate-200 bg-slate-50 pr-9"
        />
        <Search className="pointer-events-none absolute right-5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>

      {/* Vertical + horizontal: card overflow-hidden blocked x-scroll; touch-chain was pan-y only. */}
      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain-xy min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain bg-slate-100 p-2 sm:p-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className={cn(POS_PANEL.card, "w-max min-w-full overflow-visible")}>
          {tab === "open" ? (
            <PosBillListSessionTable
              rows={openRows}
              query={query}
              nowMs={nowMs}
              emptyKey={POS_BILL_LIST_I18N.emptyOpen}
              emptyFallback="No open bills yet."
              onSelect={onSelectOpen}
              onCancelBill={onCancelOpen}
              onFulfillBill={showFulfillAction ? onFulfillOpen : undefined}
            />
          ) : tab === "cancelled" ? (
            <PosBillListSessionTable
              rows={cancelledRows}
              query={query}
              nowMs={nowMs}
              emptyKey={POS_BILL_LIST_I18N.emptyCancelled}
              emptyFallback="No cancelled bills yet."
              showReason
            />
          ) : tab === "paid_refunds" ? (
            <PosBillListRefundsPanel
              rows={paidRows}
              query={query}
              nowMs={nowMs}
              refundBusyId={refundBusyId}
              onRefund={(row) => onRefundPaid?.(row)}
            />
          ) : (
            <PosBillListProductVoidsPanel voids={voids} query={query} />
          )}
        </div>
        {/* Extra scroll depth so the last row clears home-indicator / nav scrim. */}
        <div
          aria-hidden
          className="w-full flex-shrink-0"
          style={{
            height:
              "max(1.25rem, calc(0.75rem + env(safe-area-inset-bottom, 0px)), calc(0.75rem + var(--safe-area-inset-bottom, 0px)), calc(0.75rem + var(--footer-bottom-inset, 0px)))",
          }}
        />
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
            "z-[70] flex h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden border-0 bg-slate-100 p-0 sm:max-w-none",
            POS_SHEET_MOTION,
            "[&>button]:hidden",
          )}
        >
          {header(
            <SheetTitle className={cn(POS_PANEL.headerTitle, "leading-none")}>
              {titleText}
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
        className="flex h-[min(78dvh,720px)] w-[min(88vw,960px)] max-h-[min(78dvh,720px)] max-w-none flex-col gap-0 overflow-hidden rounded-lg border border-slate-200/80 bg-slate-100 p-0 shadow-sm ease-in-out data-[state=open]:duration-200 data-[state=closed]:duration-200 [&>button]:hidden"
        aria-describedby={undefined}
      >
        {header(
          <DialogTitle className={cn(POS_PANEL.headerTitle, "leading-none")}>
            {titleText}
          </DialogTitle>,
        )}
        {body}
      </DialogContent>
    </Dialog>
  );
}
