import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { usePosOutlets } from "@/8-2-2-outlets/hooks/usePosOutlets";
import { summarizeAssignedOutlets } from "@/8-2-2-outlets/lib/assignedOutlets";
import { AssignBundleOutletDialog } from "./AssignBundleOutletDialog";

export type BundleOutletsSectionProps = {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

export function BundleOutletsSection({ selectedIds, onChange }: BundleOutletsSectionProps) {
  const { t } = useAppTranslation();
  const { rows } = usePosOutlets();
  const [open, setOpen] = useState(false);
  const summary = summarizeAssignedOutlets(rows, selectedIds);

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h3 className="text-base font-semibold">
        {t("defaultPrices.bundles.outletsSection", "Assigned Outlets")}
      </h3>
      <p className="text-sm text-muted-foreground">
        {t(
          "defaultPrices.bundles.outletsHint",
          "Select outlets that you want to implement this bundle",
        )}
      </p>
      <Button type="button" className="w-full" onClick={() => setOpen(true)}>
        {t("defaultPrices.bundles.assignOutlet", "Assign Outlet")}
      </Button>
      {summary.names.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          {summary.names.join(", ")}
          {summary.extra > 0 ? ` +${summary.extra}` : ""}
        </p>
      ) : (
        <p className="text-sm text-destructive">
          {t("outlets.assign.minOne", "Please select minimum one outlet")}
        </p>
      )}
      <AssignBundleOutletDialog
        open={open}
        onOpenChange={setOpen}
        selectedIds={selectedIds}
        onConfirm={onChange}
      />
    </section>
  );
}
