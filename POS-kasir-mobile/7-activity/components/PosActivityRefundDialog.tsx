import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { POS_ACTIVITY_I18N } from "../lib/posActivityCopy";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy?: boolean;
  onConfirm: () => void;
};

export function PosActivityRefundDialog({
  open,
  onOpenChange,
  busy,
  onConfirm,
}: Props) {
  const { t } = useAppTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-3 rounded-xl p-4">
        <DialogTitle className="text-base font-semibold">
          {t(POS_ACTIVITY_I18N.refundConfirmTitle, "Refund this sale?")}
        </DialogTitle>
        <DialogDescription className="text-sm text-slate-600">
          {t(
            POS_ACTIVITY_I18N.refundConfirmDesc,
            "Stock will be restored and the sales activity rolled back.",
          )}
        </DialogDescription>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {t(POS_ACTIVITY_I18N.cancel, "Cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={onConfirm}
          >
            {t(POS_ACTIVITY_I18N.selectRefund, "Select refund")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
