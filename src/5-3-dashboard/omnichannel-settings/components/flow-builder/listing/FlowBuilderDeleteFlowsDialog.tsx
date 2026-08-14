import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";

type FlowBuilderDeleteFlowsDialogProps = {
  open: boolean;
  count: number;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  /** Override default confirm body (e.g. Meta draft-only delete rules). */
  description?: string;
};

export function FlowBuilderDeleteFlowsDialog({
  open,
  count,
  loading,
  onOpenChange,
  onConfirm,
  description,
}: FlowBuilderDeleteFlowsDialogProps) {
  const { t } = useTranslation();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("omnichannel.settings.flowBuilder.listing.deleteConfirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {description ?? t("omnichannel.settings.flowBuilder.listing.deleteConfirmBody", { count })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {t("omnichannel.settings.flowBuilder.listing.deleteConfirmAction")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
