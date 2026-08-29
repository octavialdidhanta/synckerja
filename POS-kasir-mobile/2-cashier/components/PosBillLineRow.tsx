import { Button } from "@/shared/components/ui/button";
import { formatStoreCheckoutRp } from "@/5-2-customer-visits/checkout/lib/catalogLabel";
import { lineTotal } from "@/5-2-customer-visits/checkout/lib/sumCustomerVisitCart";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { posBillLineTitle } from "../lib/posBillLineTitle";
import { posBillLineBaseUnitPrice } from "../lib/posBillLineAmounts";
import { cn } from "@/shared/lib/utils";

type AmountKind = "base" | "extra" | "discount";

function DetailAmountRow({
  label,
  amountRp,
  kind,
}: {
  label: string;
  amountRp?: number;
  kind: AmountKind;
}) {
  const showAmount = amountRp != null && (kind === "base" || amountRp > 0);
  const prefix = kind === "extra" ? "+ " : kind === "discount" ? "− " : "";
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="min-w-0 truncate text-slate-500">{label}</span>
      {showAmount ? (
        <span
          className={cn(
            "shrink-0 tabular-nums",
            kind === "discount" ? "text-rose-600" : "text-slate-700",
          )}
        >
          {prefix}
          {formatStoreCheckoutRp(amountRp ?? 0)}
        </span>
      ) : null}
    </div>
  );
}

type Props = {
  line: CustomerVisitCartLine;
  onUpdateQty: (lineKey: string, quantity: number) => void;
};

export function PosBillLineRow({ line, onUpdateQty }: Props) {
  const modifiers = line.modifiers ?? [];
  const hasDetails =
    Boolean(line.variantName?.trim()) ||
    modifiers.length > 0 ||
    Boolean(line.lineSalesTypeLabel?.trim()) ||
    Boolean(line.lineDiscount);

  return (
    <li className="rounded-md bg-slate-50 px-2.5 py-2">
      <p className="text-sm font-medium leading-snug text-slate-900">
        {posBillLineTitle(line)}
      </p>

      {hasDetails ? (
        <div className="mt-1 space-y-0.5 border-l-2 border-slate-200 pl-2">
          {line.variantName?.trim() ? (
            <DetailAmountRow
              label={line.variantName.trim()}
              amountRp={posBillLineBaseUnitPrice(line)}
              kind="base"
            />
          ) : null}
          {modifiers.map((m) => (
            <DetailAmountRow
              key={m.optionId}
              label={m.name}
              amountRp={m.extraPrice}
              kind="extra"
            />
          ))}
          {line.lineSalesTypeLabel?.trim() ? (
            <DetailAmountRow label={line.lineSalesTypeLabel.trim()} kind="base" />
          ) : null}
          {line.lineDiscount ? (
            <DetailAmountRow
              label={line.lineDiscount.name}
              amountRp={line.lineDiscount.amountRp}
              kind="discount"
            />
          ) : null}
        </div>
      ) : null}

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 w-7 p-0"
            onClick={() => onUpdateQty(line.lineKey, line.quantity - 1)}
          >
            −
          </Button>
          <span className="w-6 text-center text-xs tabular-nums">{line.quantity}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 w-7 p-0"
            onClick={() => onUpdateQty(line.lineKey, line.quantity + 1)}
          >
            +
          </Button>
        </div>
        <span className="text-sm font-semibold tabular-nums text-slate-900">
          {formatStoreCheckoutRp(lineTotal(line))}
        </span>
      </div>
    </li>
  );
}
