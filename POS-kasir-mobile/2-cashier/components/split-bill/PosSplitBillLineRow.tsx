import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import {
  catalogItemLabel,
  formatStoreCheckoutRp,
} from "@/5-2-customer-visits/checkout/lib/catalogLabel";
import { lineTotal } from "@/5-2-customer-visits/checkout/lib/sumCustomerVisitCart";
import { Check } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

type Props = {
  line: CustomerVisitCartLine;
  splitQty: number;
  selected: boolean;
  onToggle: () => void;
  onChangeQty: (qty: number) => void;
};

export function PosSplitBillLineRow({
  line,
  splitQty,
  selected,
  onToggle,
  onChangeQty,
}: Props) {
  const initials = catalogItemLabel(line).slice(0, 2).toUpperCase() || "??";
  const qty = selected ? Math.max(1, splitQty) : line.quantity;

  return (
    <div className="flex items-center gap-2 border-b border-slate-100 py-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-slate-200 text-xs font-bold text-slate-600">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">
          {catalogItemLabel(line)}
        </p>
        <p className="text-xs text-slate-500">
          {formatStoreCheckoutRp(line.unitPrice)}
          {selected ? ` · ${formatStoreCheckoutRp(lineTotal({ ...line, quantity: qty }))}` : null}
        </p>
      </div>
      <div
        className={cn(
          "flex items-center gap-1",
          !selected && "pointer-events-none opacity-40",
        )}
      >
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 w-8 border-primary p-0 text-primary"
          disabled={!selected || qty <= 1}
          onClick={() => onChangeQty(qty - 1)}
        >
          −
        </Button>
        <span className="w-7 text-center text-sm font-semibold">{qty}</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 w-8 border-primary p-0 text-primary"
          disabled={!selected || qty >= line.quantity}
          onClick={() => onChangeQty(qty + 1)}
        >
          +
        </Button>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-primary/40 bg-white",
        )}
        aria-pressed={selected}
      >
        {selected ? <Check className="h-4 w-4" /> : null}
      </button>
    </div>
  );
}
