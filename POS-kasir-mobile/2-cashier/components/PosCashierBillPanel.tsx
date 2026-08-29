import { ListOrdered, Receipt, SplitSquareVertical, UserPlus } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { CatalogCheckoutTotals } from "@/8-2-1-default-prices/checkout/lib/computeCatalogCheckoutTotals";
import { formatCatalogCheckoutLineLabel } from "@/8-2-1-default-prices/checkout/lib/formatCatalogCheckoutLineLabel";
import { formatStoreCheckoutRp } from "@/5-2-customer-visits/checkout/lib/catalogLabel";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { PosBillLineRow } from "./PosBillLineRow";
import { POS_CASHIER_I18N } from "../lib/posCashierCopy";

type SalesTypeOption = { id: string; name: string };

type Props = {
  lines: CustomerVisitCartLine[];
  checkoutTotals: CatalogCheckoutTotals;
  salesTypeId: string;
  salesTypeOptions: SalesTypeOption[];
  onSalesTypeChange: (id: string) => void;
  customerLabel: string | null;
  onAddCustomer: () => void;
  tableLabel?: string | null;
  tableDuration?: string | null;
  onClearTable?: () => void;
  onUpdateQty: (lineKey: string, quantity: number) => void;
  onOpenBillList: () => void;
  onSaveBill: () => void;
  /** True when bill already has an open session (resumed from Bill List). */
  saveBillDisabled?: boolean;
  onPrintBill: () => void;
  onSplitBill: () => void;
  onPay: () => void;
  paying?: boolean;
};

export function PosCashierBillPanel({
  lines,
  checkoutTotals,
  salesTypeId,
  salesTypeOptions,
  onSalesTypeChange,
  customerLabel,
  onAddCustomer,
  tableLabel,
  tableDuration,
  onClearTable,
  onUpdateQty,
  onOpenBillList,
  onSaveBill,
  saveBillDisabled,
  onPrintBill,
  onSplitBill,
  onPay,
  paying,
}: Props) {
  const { t, language } = useAppTranslation();
  const { subtotal, gratuityLines, taxLines, grandTotal, applicationMethod } = checkoutTotals;
  const showBreakdown =
    lines.length > 0 && (gratuityLines.length > 0 || taxLines.length > 0);

  return (
    <aside className="flex h-full min-h-0 w-full max-w-md flex-col border-l border-slate-200 bg-white">
      <div className="flex items-center gap-2 bg-brand-blue-soft px-3 py-2">
        <button
          type="button"
          className="flex flex-col items-center gap-0.5 rounded-md px-2 py-1 text-primary transition-colors hover:bg-primary/10"
          onClick={onOpenBillList}
        >
          <ListOrdered className="h-5 w-5" />
          <span className="text-[10px] font-medium">
            {t(POS_CASHIER_I18N.billList, "Bill List")}
          </span>
        </button>
        <button
          type="button"
          onClick={onAddCustomer}
          className="flex flex-1 items-center justify-center gap-1 rounded-md bg-white px-3 py-2 text-sm font-semibold text-primary shadow-sm transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          <UserPlus className="h-4 w-4" />
          {customerLabel || t(POS_CASHIER_I18N.addCustomer, "+ Add Customer")}
        </button>
      </div>

      {tableLabel ? (
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-emerald-50/80 px-3 py-1.5">
          <span className="truncate text-xs font-medium text-emerald-900">
            {t(POS_CASHIER_I18N.tableLabel, "Table: {{name}}", { name: tableLabel })}
            {tableDuration ? (
              <span className="ml-2 font-normal text-emerald-700/80">· {tableDuration}</span>
            ) : null}
          </span>
          {onClearTable ? (
            <button
              type="button"
              onClick={onClearTable}
              className="flex-shrink-0 rounded px-2 py-0.5 text-[11px] font-medium text-emerald-800 underline-offset-2 hover:underline"
            >
              {t(POS_CASHIER_I18N.clearTable, "Walk-in")}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="border-b border-slate-100 px-3 py-2">
        <Select value={salesTypeId || undefined} onValueChange={onSalesTypeChange}>
          <SelectTrigger className="h-10 w-full border-slate-200 bg-white">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {salesTypeOptions.map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>
                {opt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {lines.length === 0 ? (
          <div className="flex h-full min-h-[120px] items-center justify-center text-sm text-slate-400">
            {t(POS_CASHIER_I18N.noProducts, "No Products")}
          </div>
        ) : (
          <ul className="space-y-2">
            {lines.map((line) => (
              <PosBillLineRow
                key={line.lineKey}
                line={line}
                onUpdateQty={onUpdateQty}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2 border-t border-slate-100 p-3">
        {showBreakdown ? (
          <div className="space-y-1 pb-1 text-xs text-slate-600">
            <div className="flex justify-between gap-2">
              <span>{t(POS_CASHIER_I18N.subtotal, "Subtotal")}</span>
              <span className="tabular-nums">{formatStoreCheckoutRp(subtotal)}</span>
            </div>
            {gratuityLines.map((line) => (
              <div key={`g-${line.name}`} className="flex justify-between gap-2">
                <span>
                  {formatCatalogCheckoutLineLabel({
                    name: line.name,
                    amountPercent: line.amount_percent,
                    locale: language,
                    includedLabel:
                      applicationMethod === "include"
                        ? t(POS_CASHIER_I18N.includedInPrice, "included")
                        : null,
                  })}
                </span>
                <span className="tabular-nums">{formatStoreCheckoutRp(line.amount)}</span>
              </div>
            ))}
            {taxLines.map((line) => (
              <div key={`t-${line.name}`} className="flex justify-between gap-2">
                <span>
                  {formatCatalogCheckoutLineLabel({
                    name: line.name,
                    amountPercent: line.amount_percent,
                    locale: language,
                    includedLabel:
                      applicationMethod === "include"
                        ? t(POS_CASHIER_I18N.includedInPrice, "included")
                        : null,
                  })}
                </span>
                <span className="tabular-nums">{formatStoreCheckoutRp(line.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between gap-2 border-t border-slate-100 pt-1 text-sm font-semibold text-slate-900">
              <span>{t(POS_CASHIER_I18N.total, "Total")}</span>
              <span className="tabular-nums">{formatStoreCheckoutRp(grandTotal)}</span>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="secondary"
            className="h-11 bg-brand-blue-soft text-brand-blue-on-soft hover:bg-primary/15 hover:text-primary disabled:opacity-40"
            onClick={onSaveBill}
            disabled={saveBillDisabled || lines.length === 0}
          >
            <Receipt className="mr-1 h-4 w-4" />
            {t(POS_CASHIER_I18N.saveBill, "Save Bill")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-11 bg-brand-blue-soft text-brand-blue-on-soft hover:bg-primary/15 hover:text-primary"
            onClick={onPrintBill}
          >
            {t(POS_CASHIER_I18N.printBill, "Print Bill")}
          </Button>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSplitBill}
            className="flex w-16 flex-col items-center justify-center rounded-md bg-brand-blue-soft px-1 py-2 text-[10px] font-medium text-brand-blue-on-soft transition-colors hover:bg-primary/15 hover:text-primary"
          >
            <SplitSquareVertical className="mb-0.5 h-4 w-4" />
            {t(POS_CASHIER_I18N.splitBill, "Split Bill")}
          </button>
          <Button
            type="button"
            disabled={paying || lines.length === 0 || grandTotal <= 0}
            onClick={onPay}
            className="h-14 flex-1 rounded-md bg-primary text-base font-semibold text-primary-foreground hover:bg-brand-blue-deep disabled:bg-primary/40"
          >
            {t(POS_CASHIER_I18N.pay, "Pay")} {formatStoreCheckoutRp(grandTotal)}
          </Button>
        </div>
      </div>
    </aside>
  );
}
