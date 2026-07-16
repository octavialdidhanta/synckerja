import { memo, type ReactNode } from "react";
import { Badge } from "@/shared/components/ui/badge";
import { formatIDR } from "@/10-subscription/shared/subscriptionUtils";
import { cn } from "@/shared/lib/utils";

type PriceLineStrikethroughProps = {
  title: ReactNode;
  formula?: string;
  grossIdr: number;
  netIdr: number;
  discountPct?: number | null;
  size?: "sm" | "md";
  /** Keep price on the title row (e.g. add-on cards), even when discounted. */
  priceAlignWithTitle?: boolean;
  className?: string;
};

const DiscountPriceStrip = memo(
  ({
    grossIdr,
    netIdr,
    discountPct,
    hasDiscount,
    formulaSize,
    priceSize,
  }: {
    grossIdr: number;
    netIdr: number;
    discountPct: number;
    hasDiscount: boolean;
    formulaSize: string;
    priceSize: string;
  }) => {
    if (!hasDiscount) {
      return (
        <span className={cn("shrink-0 font-semibold text-foreground", priceSize)}>
          {formatIDR(netIdr)}
        </span>
      );
    }
    return (
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
        <span className={cn("text-muted-foreground line-through", formulaSize)}>
          {formatIDR(grossIdr)}
        </span>
        <span className="text-[10px] text-muted-foreground/70" aria-hidden>
          →
        </span>
        <span className={cn("font-semibold text-foreground", priceSize)}>
          {formatIDR(netIdr)}
        </span>
        <Badge
          variant="outline"
          className="h-5 shrink-0 border-brand-red/30 bg-brand-red/5 px-1.5 text-[10px] font-semibold text-brand-red"
        >
          −{discountPct}%
        </Badge>
      </div>
    );
  },
);

DiscountPriceStrip.displayName = "DiscountPriceStrip";

export const PriceLineStrikethrough = memo(
  ({
    title,
    formula,
    grossIdr,
    netIdr,
    discountPct,
    size = "md",
    priceAlignWithTitle = false,
    className,
  }: PriceLineStrikethroughProps) => {
    const hasDiscount =
      discountPct != null && discountPct > 0 && grossIdr > netIdr;
    const titleSize = size === "sm" ? "text-xs" : "text-sm";
    const formulaSize = size === "sm" ? "text-[11px]" : "text-xs";
    const priceSize = size === "sm" ? "text-xs" : "text-sm";
    const resolvedDiscountPct = discountPct ?? 0;

    const formulaClass = cn("mt-px block leading-tight text-muted-foreground/90", formulaSize);

    if (priceAlignWithTitle) {
      return (
        <div className={cn(className)}>
          <div className="flex items-start justify-between gap-2 leading-tight">
            <div className={cn("min-w-0 font-medium text-foreground", titleSize)}>{title}</div>
            <DiscountPriceStrip
              grossIdr={grossIdr}
              netIdr={netIdr}
              discountPct={resolvedDiscountPct}
              hasDiscount={hasDiscount}
              formulaSize={formulaSize}
              priceSize={priceSize}
            />
          </div>
          {formula ? <span className={formulaClass}>{formula}</span> : null}
        </div>
      );
    }

    return (
      <div className={cn(className)}>
        {hasDiscount ? (
          <>
            <div className={cn("font-medium leading-tight text-foreground", titleSize)}>{title}</div>
            {formula ? <span className={formulaClass}>{formula}</span> : null}
            <div className="mt-1 flex flex-wrap items-center justify-end gap-1.5">
              <span className={cn("text-muted-foreground line-through", formulaSize)}>
                {formatIDR(grossIdr)}
              </span>
              <span className="text-[10px] text-muted-foreground/70" aria-hidden>
                →
              </span>
              <span className={cn("font-semibold text-foreground", priceSize)}>
                {formatIDR(netIdr)}
              </span>
              <Badge
                variant="outline"
                className="h-5 shrink-0 border-brand-red/30 bg-brand-red/5 px-1.5 text-[10px] font-semibold text-brand-red"
              >
                −{discountPct}%
              </Badge>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2 leading-tight">
              <div className={cn("min-w-0 font-medium text-foreground", titleSize)}>{title}</div>
              <span className={cn("shrink-0 font-semibold text-foreground", priceSize)}>
                {formatIDR(netIdr)}
              </span>
            </div>
            {formula ? <span className={formulaClass}>{formula}</span> : null}
          </>
        )}
      </div>
    );
  },
);

PriceLineStrikethrough.displayName = "PriceLineStrikethrough";
