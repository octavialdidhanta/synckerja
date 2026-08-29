import { formatStoreCheckoutRp } from "@/5-2-customer-visits/checkout/lib/catalogLabel";
import { cn } from "@/shared/lib/utils";
import type { PosActivityProductLine } from "../lib/posActivityTypes";

type Props = {
  line: PosActivityProductLine;
  badge: string;
};

export function PosActivityProductRow({ line, badge }: Props) {
  return (
    <li className="py-3">
      <div className="flex items-start gap-2.5">
        <span
          className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-slate-400 text-xs font-bold uppercase text-white"
          aria-hidden
        >
          {badge}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">
                {line.quantity > 1 ? `${line.quantity}× ` : null}
                {line.title}
              </p>
              {line.subtitle ? (
                <p className="mt-0.5 text-xs text-slate-500">{line.subtitle}</p>
              ) : null}
            </div>
            <span className="flex-shrink-0 text-sm tabular-nums text-slate-800">
              {formatStoreCheckoutRp(line.amountRp)}
            </span>
          </div>

          {line.children.length > 0 ? (
            <ul className="mt-1.5 space-y-1 pl-0.5">
              {line.children.map((child) => (
                <li
                  key={child.key}
                  className="flex items-baseline justify-between gap-3 text-xs"
                >
                  <span className="min-w-0 text-slate-500">{child.label}</span>
                  <span
                    className={cn(
                      "flex-shrink-0 tabular-nums",
                      child.kind === "discount" ? "text-rose-600" : "text-slate-600",
                    )}
                  >
                    {child.kind === "discount" ? "(" : null}
                    {child.kind === "discount" ? "− " : null}
                    {formatStoreCheckoutRp(child.amountRp)}
                    {child.kind === "discount" ? ")" : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </li>
  );
}
