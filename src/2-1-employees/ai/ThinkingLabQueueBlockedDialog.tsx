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

export type ThinkingLabQueueBlockReason = "path_unconfirmed" | "ideas_blocked";

type Props = {
  open: boolean;
  reason: ThinkingLabQueueBlockReason | null;
  onOpenChange: (open: boolean) => void;
  onOpenThinkingLab: () => void;
};

export function ThinkingLabQueueBlockedDialog({
  open,
  reason,
  onOpenChange,
  onOpenThinkingLab,
}: Props) {
  const { t } = useAppTranslation();
  const pathMissing = reason === "path_unconfirmed";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("aiEmployee.schedule.generateFailed", "Plan tidak dibuat.")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pathMissing
              ? t(
                  "aiEmployee.schedule.pathUnconfirmed",
                  "Belum ada jalur kreatif siap (idea × pilar yang sudah di-lock di Thinking Lab) untuk Fokus angle. Buka Thinking Lab, lock pilar di Creative Path, lalu Generate lagi.",
                )
              : t(
                  "aiEmployee.schedule.ideasBlocked",
                  "Belum ada ide locked+lolos di Fokus angle. Buka Thinking Lab, kunci ide yang lolos, lalu Generate lagi.",
                )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("aiEmployee.schedule.queueBlockedClose", "Tutup")}</AlertDialogCancel>
          <Button type="button" onClick={onOpenThinkingLab}>
            {t("aiEmployee.schedule.openThinkingLab", "Buka Thinking Lab")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
