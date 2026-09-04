import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import { formatStoreCheckoutRp } from "@/5-2-customer-visits/checkout/lib/catalogLabel";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import type { CatalogCheckoutTotals } from "@/8-2-1-default-prices/checkout/lib/computeCatalogCheckoutTotals";
import {
  mergePosCheckoutTotalsWithCustom,
  splitPosCartLines,
} from "../../lib/posCustomAmount";
import { hasAnySplitSelection, splitCartLinesByQty } from "../../lib/splitCartLines";
import { POS_SPLIT_BILL_I18N } from "../../lib/posSplitBillCopy";
import { usePosCashierIsPhoneLayout } from "../../hooks/usePosCashierIsPhoneLayout";
import { PosSplitBillLineRow } from "./PosSplitBillLineRow";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lines: CustomerVisitCartLine[];
  salesTypeLabel: string;
  computeTotals: (lines: CustomerVisitCartLine[]) => CatalogCheckoutTotals;
  onConfirmSplit: (selection: Map<string, number>) => void;
};

export function PosSplitBillDialog({
  open,
  onOpenChange,
  lines,
  salesTypeLabel,
  computeTotals,
  onConfirmSplit,
}: Props) {
  const { t } = useAppTranslation();
  const isPhone = usePosCashierIsPhoneLayout();
  const [selected, setSelected] = useState<Map<string, number>>(() => new Map());

  useEffect(() => {
    if (open) setSelected(new Map());
  }, [open]);

  const amount = useMemo(() => {
    const { splitLines } = splitCartLinesByQty(lines, selected);
    const { catalogLines, customTotal } = splitPosCartLines(splitLines);
    const priced = computeTotals(catalogLines);
    return mergePosCheckoutTotalsWithCustom(priced, customTotal).grandTotal;
  }, [lines, selected, computeTotals]);

  const canSplit = hasAnySplitSelection(selected);
  const titleText = t(POS_SPLIT_BILL_I18N.title, "Split Bill");

  const header = (titleNode: ReactNode) => (
    <div className="relative flex shrink-0 items-center justify-center border-b border-slate-100 px-3 py-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="absolute left-3 top-1/2 -translate-y-1/2 border-primary text-primary"
        onClick={() => onOpenChange(false)}
      >
        {t(POS_SPLIT_BILL_I18N.cancel, "Cancel")}
      </Button>
      {titleNode}
      <Button
        type="button"
        size="sm"
        className="absolute right-3 top-1/2 -translate-y-1/2"
        disabled={!canSplit}
        onClick={() => {
          if (!canSplit) return;
          onConfirmSplit(new Map(selected));
        }}
      >
        {t(POS_SPLIT_BILL_I18N.split, "Split")}
      </Button>
    </div>
  );

  const body = (
    <>
      <div className="mx-3 mt-3 flex shrink-0 items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
        <span className="text-sm text-slate-600">
          {t(POS_SPLIT_BILL_I18N.amountLabel, "Amount to split")}
        </span>
        <span className="text-sm font-semibold tabular-nums">
          {formatStoreCheckoutRp(amount)}
        </span>
      </div>

      <div
        className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4 pt-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        data-vaul-no-drag=""
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t(POS_SPLIT_BILL_I18N.productsHeading, "Products to split")}
        </p>
        {lines.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">
            {t(POS_SPLIT_BILL_I18N.empty, "No products on this bill.")}
          </p>
        ) : (
          <>
            <p className="mb-1 text-sm font-semibold text-slate-800">
              {salesTypeLabel || "Dine in"}
            </p>
            {lines.map((line) => {
              const isOn = selected.has(line.lineKey);
              const qty = selected.get(line.lineKey) ?? line.quantity;
              return (
                <PosSplitBillLineRow
                  key={line.lineKey}
                  line={line}
                  splitQty={qty}
                  selected={isOn}
                  onToggle={() => {
                    setSelected((prev) => {
                      const next = new Map(prev);
                      if (next.has(line.lineKey)) next.delete(line.lineKey);
                      else next.set(line.lineKey, line.quantity);
                      return next;
                    });
                  }}
                  onChangeQty={(nextQty) => {
                    setSelected((prev) => {
                      const next = new Map(prev);
                      next.set(
                        line.lineKey,
                        Math.min(line.quantity, Math.max(1, nextQty)),
                      );
                      return next;
                    });
                  }}
                />
              );
            })}
          </>
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
        className="flex max-h-[min(82dvh,640px)] w-[min(92vw,520px)] max-w-none flex-col gap-0 overflow-hidden rounded-xl border-0 p-0 shadow-xl [&>button]:hidden"
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
