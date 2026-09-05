import { Wallet } from "lucide-react";
import { formatStoreCheckoutRp } from "@/5-2-customer-visits/checkout/lib/catalogLabel";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { posActivityListRowAmount } from "../lib/groupPosActivitiesByDate";
import { POS_ACTIVITY_I18N } from "../lib/posActivityCopy";
import type { PosActivityListRow as PosActivityListRowType } from "../lib/posActivityTypes";

type Props = {
  row: PosActivityListRowType;
  selected: boolean;
  onSelect: () => void;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export function PosActivityListRow({ row, selected, onSelect }: Props) {
  const { t } = useAppTranslation();
  const amount = posActivityListRowAmount(row);
  const isRefunded = row.refund_status === "full";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-2.5 border-b border-slate-100 px-3 py-3 text-left transition",
        selected
          ? "bg-primary text-white"
          : "bg-white text-slate-900 hover:bg-slate-50",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md",
          selected ? "bg-white/15" : "bg-slate-100 text-slate-600",
        )}
      >
        <Wallet className={cn("h-4 w-4", selected && "text-white")} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className={cn("text-sm font-semibold", selected && "text-white")}>
            {formatStoreCheckoutRp(amount)}
          </span>
          <span
            className={cn(
              "flex-shrink-0 text-xs tabular-nums",
              selected ? "text-white/80" : "text-slate-500",
            )}
          >
            {formatTime(row.created_at)}
          </span>
        </span>
        {isRefunded ? (
          <span
            className={cn(
              "mt-0.5 inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              selected ? "bg-white/20 text-white" : "bg-amber-50 text-amber-800",
            )}
          >
            {t(POS_ACTIVITY_I18N.refundedBadge, "Refunded")}
          </span>
        ) : null}
        {row.itemSummary ? (
          <span
            className={cn(
              "mt-0.5 line-clamp-2 block text-xs",
              selected ? "text-white/85" : "text-slate-500",
            )}
          >
            {row.itemSummary}
          </span>
        ) : null}
      </span>
    </button>
  );
}
