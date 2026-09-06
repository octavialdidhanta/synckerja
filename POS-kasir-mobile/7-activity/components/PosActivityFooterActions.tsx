import { Check, Mail, Undo2 } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { POS_ACTIVITY_I18N } from "../lib/posActivityCopy";

type Props = {
  canSend: boolean;
  receiptAlreadySent?: boolean;
  canRefund: boolean;
  isRefunded?: boolean;
  refundBusy?: boolean;
  onSendReceipt: () => void;
  onSelectRefund: () => void;
  className?: string;
};

/** Flat Send + Refund for the blue app footer — matches Shift footer actions. */
export function PosActivityFooterActions({
  canSend,
  receiptAlreadySent,
  canRefund,
  isRefunded,
  refundBusy,
  onSendReceipt,
  onSelectRefund,
  className,
}: Props) {
  const { t } = useAppTranslation();

  const actionClass = (opts?: { active?: boolean; muted?: boolean }) =>
    cn(
      "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-2 py-2 text-center text-xs font-semibold text-white transition-colors sm:text-sm",
      opts?.active
        ? "bg-white/25"
        : "bg-transparent hover:bg-white/15 active:bg-white/20",
      opts?.muted && "opacity-70",
      "disabled:opacity-50",
    );

  const sendDisabled = !canSend;
  const refundDisabled = isRefunded || !canRefund || refundBusy;

  return (
    <div className={cn("flex min-h-14 min-w-0 flex-1 items-stretch", className)}>
      <button
        type="button"
        disabled={sendDisabled}
        onClick={onSendReceipt}
        className={actionClass({ active: receiptAlreadySent })}
      >
        {receiptAlreadySent ? (
          <Check className="h-4 w-4" aria-hidden strokeWidth={2.5} />
        ) : (
          <Mail className="h-4 w-4" aria-hidden />
        )}
        {t(POS_ACTIVITY_I18N.sendReceipt, "Send receipt")}
      </button>
      <div className="w-px flex-shrink-0 self-stretch bg-white/25" aria-hidden />
      <button
        type="button"
        disabled={refundDisabled}
        onClick={onSelectRefund}
        className={actionClass({ muted: isRefunded })}
      >
        <Undo2 className="h-4 w-4" aria-hidden />
        {isRefunded
          ? t(POS_ACTIVITY_I18N.refundedBadge, "Refunded")
          : t(POS_ACTIVITY_I18N.selectRefund, "Select refund")}
      </button>
    </div>
  );
}
