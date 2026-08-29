import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { POS_BILL_LIST_I18N, POS_BILL_REASON_MIN_LEN } from "../../lib/posBillListCopy";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onConfirm: (reason: string) => void;
  confirming?: boolean;
};

/** Shared free-text reason dialog for bill cancel / product void. */
export function PosBillReasonDialog({
  open,
  onOpenChange,
  title,
  onConfirm,
  confirming,
}: Props) {
  const { t } = useAppTranslation();
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();
  const canSubmit = trimmed.length >= POS_BILL_REASON_MIN_LEN && !confirming;

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
      <DialogContent className="max-w-md gap-3 rounded-xl p-4 [&>button]:hidden" aria-describedby={undefined}>
        <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t(POS_BILL_LIST_I18N.reasonPlaceholder, "e.g. Customer changed mind")}
          maxLength={200}
          autoFocus
        />
        {trimmed.length > 0 && trimmed.length < POS_BILL_REASON_MIN_LEN ? (
          <p className="text-xs text-destructive">
            {t(POS_BILL_LIST_I18N.reasonRequired, "Reason must be at least 3 characters")}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={confirming}
          >
            {t(POS_BILL_LIST_I18N.cancel, "Cancel")}
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              if (!canSubmit) return;
              onConfirm(trimmed);
              setReason("");
            }}
          >
            {t(POS_BILL_LIST_I18N.confirm, "Confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
