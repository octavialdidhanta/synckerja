import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";

type Props = {
  title: string;
  statusLabel: string;
  tone?: "neutral" | "success" | "warning";
  leading?: ReactNode;
  trailingExtra?: ReactNode;
};

export function PosPaymentMethodStatusRow({
  title,
  statusLabel,
  tone = "neutral",
  leading,
  trailingExtra,
}: Props) {
  return (
    <div className={POS_PANEL.row}>
      {leading ? (
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden">
          {leading}
        </div>
      ) : null}
      <span className="min-w-0 flex-1 text-sm font-medium tracking-wide text-slate-700">
        {title}
      </span>
      <div className="flex flex-shrink-0 items-center gap-2">
        {trailingExtra}
        <span
          className={cn(
            "text-sm font-semibold",
            tone === "success" && "text-emerald-600",
            tone === "warning" && "text-amber-700",
            tone === "neutral" && "text-slate-500",
          )}
        >
          {statusLabel}
        </span>
      </div>
    </div>
  );
}
