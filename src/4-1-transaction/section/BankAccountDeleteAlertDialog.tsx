import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  /** Shown in the body when deleting a known row (optional). */
  accountName?: string | null;
};

export function BankAccountDeleteAlertDialog({ open, onOpenChange, onConfirm, accountName }: Props) {
  const { t } = useAppTranslation();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) setBusy(false);
  }, [open]);

  const handleDeleteClick = () => {
    void (async () => {
      setBusy(true);
      try {
        await Promise.resolve(onConfirm());
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("incomes.deleteBankAccountTitle", "Delete bank account")}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>{t("incomes.deleteBankAccountBody", "Are you sure you want to delete this bank account?")}</p>
              {accountName ? <p className="font-semibold text-foreground">{accountName}</p> : null}
              <p>{t("incomes.deleteBankAccountIrreversible", "This action cannot be undone.")}</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("common.cancel", "Cancel")}</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            className={cn("bg-brand-red hover:bg-brand-red/90")}
            onClick={handleDeleteClick}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                {t("common.deleting", "Deleting...")}
              </>
            ) : (
              t("common.delete", "Delete")
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
