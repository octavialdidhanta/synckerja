import { AssignOutletsDialog } from "@/8-2-2-outlets/components/AssignOutletsDialog";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export type AssignCategoryOutletDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
};

export function AssignCategoryOutletDialog({
  open,
  onOpenChange,
  selectedIds,
  onConfirm,
}: AssignCategoryOutletDialogProps) {
  const { t } = useAppTranslation();
  return (
    <AssignOutletsDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("defaultPrices.category.assignOutletTitle", "Assign Category to Outlet")}
      confirmLabel={t("defaultPrices.category.assignCategory", "Assign Category")}
      selectedIds={selectedIds}
      onConfirm={onConfirm}
      chrome="pos"
    />
  );
}
