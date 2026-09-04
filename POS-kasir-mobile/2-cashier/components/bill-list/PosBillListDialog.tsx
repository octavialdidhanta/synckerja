import { useEffect, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
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

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setQuery("");
    }
  }, [open, initialTab]);

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

  const header = (titleNode: ReactNode) => (
    <div className="relative flex flex-shrink-0 items-center justify-center border-b border-slate-100 px-4 py-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="absolute left-3 top-1/2 -translate-y-1/2 border-primary text-primary"
        onClick={() => onOpenChange(false)}
      >
        {t(POS_BILL_LIST_I18N.close, "Close")}
      </Button>
      {titleNode}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="absolute right-3 top-1/2 -translate-y-1/2 border-primary text-primary"
        onClick={onNewBill}
      >
        {t(POS_BILL_LIST_I18N.newBill, "New Bill")}
      </Button>
    </div>
  );

  const body = (
    <>
      <div className="scrollbar-hide flex flex-shrink-0 gap-2 overflow-x-auto border-b border-slate-100 px-3 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                ? "border-primary bg-primary text-primary-foreground"
                : "border-primary/40 bg-white text-primary hover:bg-primary/5",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="relative flex-shrink-0 border-b border-slate-100 px-3 py-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-10 pr-9"
        />
        <Search className="pointer-events-none absolute right-5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>

      <div
        className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        data-vaul-no-drag=""
      >
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
    </>
  );

  if (isPhone) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} dismissible>
        <DrawerContent
          aboveAppNav={false}
          smoothFast
          className="z-[70] flex h-[min(88dvh,860px)] max-h-[min(88dvh,860px)] flex-col gap-0 overflow-hidden rounded-t-2xl border-0 p-0 pb-[max(env(safe-area-inset-bottom,0px),0.5rem)] shadow-2xl"
          overlayClassName="z-[70]"
        >
          {header(
            <DrawerTitle className="text-base font-semibold">{titleText}</DrawerTitle>,
          )}
          {body}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[min(78dvh,720px)] w-[min(88vw,960px)] max-h-[min(78dvh,720px)] max-w-none flex-col gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-2xl [&>button]:hidden"
        aria-describedby={undefined}
      >
        {header(
          <DialogTitle className="text-base font-semibold">{titleText}</DialogTitle>,
        )}
        {body}
      </DialogContent>
    </Dialog>
  );
}
