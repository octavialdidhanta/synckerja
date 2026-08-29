import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { isValidRecipientEmail, normalizeRecipientEmail } from "../lib/validateRecipientEmail";

type AddEmailRecipientDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (email: string) => Promise<void>;
  busy?: boolean;
};

export function AddEmailRecipientDialog({
  open,
  onOpenChange,
  onConfirm,
  busy = false,
}: AddEmailRecipientDialogProps) {
  const { t } = useAppTranslation();
  const [email, setEmail] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const reset = () => {
    setEmail("");
    setLocalError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleConfirm = async () => {
    const normalized = normalizeRecipientEmail(email);
    if (!isValidRecipientEmail(normalized)) {
      setLocalError(
        t("settings.emailNotifications.errors.emailInvalid", "Please enter a valid email address."),
      );
      return;
    }

    setLocalError(null);
    try {
      await onConfirm(normalized);
      reset();
      onOpenChange(false);
    } catch {
      // Parent handles toast; keep dialog open.
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="rounded-t-lg bg-primary px-4 py-3 text-primary-foreground">
          <DialogTitle className="text-center text-base font-semibold text-primary-foreground">
            {t("settings.emailNotifications.addDialog.title", "Add Email Recipients")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 px-4 py-4">
          <div className="rounded-md bg-primary/90 px-3 py-2 text-center text-sm font-medium text-primary-foreground">
            {t("settings.emailNotifications.addDialog.addLabel", "Add")}
          </div>
          <Input
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (localError) setLocalError(null);
            }}
            placeholder={t("settings.emailNotifications.addDialog.placeholder", "email@example.com")}
            disabled={busy}
            autoFocus
          />
          {localError ? <p className="text-sm text-destructive">{localError}</p> : null}
        </div>
        <DialogFooter className="flex-row justify-between gap-2 border-t px-4 py-3 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={busy}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button type="button" onClick={() => void handleConfirm()} disabled={busy}>
            {t("common.confirm", "Confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
