import { AssignOutletsDialog } from "@/8-2-2-outlets/components/AssignOutletsDialog";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export type AssignProductOutletDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
};

export function AssignProductOutletDialog({
  open,
  onOpenChange,
  selectedIds,
  onConfirm,
}: AssignProductOutletDialogProps) {
  const { t } = useAppTranslation();
  return (
    <AssignOutletsDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("defaultPrices.product.assignOutletTitle", "Assign Product to Outlet")}
      confirmLabel={t("defaultPrices.product.assignProduct", "Assign Product")}
      selectedIds={selectedIds}
      onConfirm={onConfirm}
    />
  );
}
