import { AssignOutletsDialog } from "@/8-2-2-outlets/components/AssignOutletsDialog";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export type AssignBundleOutletDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
};

export function AssignBundleOutletDialog({
  open,
  onOpenChange,
  selectedIds,
  onConfirm,
}: AssignBundleOutletDialogProps) {
  const { t } = useAppTranslation();
  return (
    <AssignOutletsDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("defaultPrices.bundles.assignOutletTitle", "Assign Bundle to Outlet")}
      confirmLabel={t("defaultPrices.bundles.assignBundle", "Assign Bundle")}
      selectedIds={selectedIds}
      onConfirm={onConfirm}
    />
  );
}
