import { AssignOutletsDialog } from "@/8-2-2-outlets/components/AssignOutletsDialog";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export type AssignGratuityOutletDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
};

export function AssignGratuityOutletDialog({
  open,
  onOpenChange,
  selectedIds,
  onConfirm,
}: AssignGratuityOutletDialogProps) {
  const { t } = useAppTranslation();
  return (
    <AssignOutletsDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("defaultPrices.gratuity.assignOutletTitle", "Assign Gratuity to Outlet")}
      confirmLabel={t("defaultPrices.gratuity.assignGratuity", "Assign Gratuity")}
      selectedIds={selectedIds}
      onConfirm={onConfirm}
    />
  );
}
