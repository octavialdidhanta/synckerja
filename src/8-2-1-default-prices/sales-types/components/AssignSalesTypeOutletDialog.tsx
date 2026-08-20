import { AssignOutletsDialog } from "@/8-2-2-outlets/components/AssignOutletsDialog";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export type AssignSalesTypeOutletDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
};

export function AssignSalesTypeOutletDialog({
  open,
  onOpenChange,
  selectedIds,
  onConfirm,
}: AssignSalesTypeOutletDialogProps) {
  const { t } = useAppTranslation();
  return (
    <AssignOutletsDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("defaultPrices.salesType.assignOutletTitle", "Assign Sales Type to Outlet")}
      confirmLabel={t("defaultPrices.salesType.assignSalesType", "Assign Sales Type")}
      selectedIds={selectedIds}
      onConfirm={onConfirm}
    />
  );
}
