import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Textarea } from "@/shared/components/ui/textarea";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  canConfirmPosCheckoutRefund,
  POS_REFUND_I18N,
  POS_REFUND_WASTE_REASON_MIN_LEN,
  type RefundStockPolicy,
} from "../../lib/refund";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy?: boolean;
  policyLoading?: boolean;
  policyError?: string | null;
  policy: RefundStockPolicy | null;
  onConfirm: (reason: string | null) => void;
};

export function PosCheckoutRefundDialog({
  open,
  onOpenChange,
  busy,
  policyLoading,
  policyError,
  policy,
  onConfirm,
}: Props) {
  const { t } = useAppTranslation();
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();
  const isWaste = policy === "waste";
  const canSubmit = canConfirmPosCheckoutRefund({
    policy,
    policyLoading: policyLoading || Boolean(policyError),
    busy,
    reason: trimmed,
  });

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setReason("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md gap-3 rounded-xl p-4">
        <DialogTitle className="text-base font-semibold">
          {t(POS_REFUND_I18N.confirmTitle, "Refund this sale?")}
        </DialogTitle>
        <DialogDescription className="text-sm text-slate-600">
          {policyError
            ? policyError
            : policyLoading || !policy
            ? t(POS_REFUND_I18N.policyLoading, "Checking kitchen tickets…")
            : isWaste
              ? t(
                  POS_REFUND_I18N.confirmDescWaste,
                  "Money will be refunded. Stock will not be restored because the kitchen already started this order.",
                )
              : t(
                  POS_REFUND_I18N.confirmDescRestore,
                  "Money and stock will be restored.",
                )}
        </DialogDescription>
        {policy ? (
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-slate-700">
              {isWaste
                ? t(POS_REFUND_I18N.reasonLabelWaste, "Reason (required)")
                : t(POS_REFUND_I18N.reasonLabelRestore, "Reason (optional)")}
            </span>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t(
                POS_REFUND_I18N.reasonPlaceholder,
                "e.g. Guest left / wrong order",
              )}
              maxLength={200}
              disabled={busy || policyLoading || !policy}
              rows={3}
            />
            {isWaste && trimmed.length > 0 && trimmed.length < POS_REFUND_WASTE_REASON_MIN_LEN ? (
              <span className="text-xs text-destructive">
                {t(
                  POS_REFUND_I18N.reasonRequired,
                  "Reason must be at least 3 characters",
                )}
              </span>
            ) : null}
          </label>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {t(POS_REFUND_I18N.cancel, "Cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canSubmit}
            onClick={() => {
              if (!canSubmit) return;
              onConfirm(trimmed.length > 0 ? trimmed : null);
            }}
          >
            {t(POS_REFUND_I18N.confirm, "Select refund")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
