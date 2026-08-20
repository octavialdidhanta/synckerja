import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { usePosOutlets } from "@/8-2-2-outlets/hooks/usePosOutlets";
import { summarizeAssignedOutlets } from "@/8-2-2-outlets/lib/assignedOutlets";
import { AssignBrandOutletDialog } from "./AssignBrandOutletDialog";

export type BrandOutletsSectionProps = {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

export function BrandOutletsSection({ selectedIds, onChange }: BrandOutletsSectionProps) {
  const { t } = useAppTranslation();
  const { rows } = usePosOutlets();
  const [open, setOpen] = useState(false);
  const summary = summarizeAssignedOutlets(rows, selectedIds);

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h3 className="text-sm font-semibold">
        {t("defaultPrices.brands.outletsSection", "Assigned Outlets")}
      </h3>
      <p className="text-xs text-muted-foreground">
        {t("defaultPrices.brands.outletsHint", "Select outlets that use this brand")}
      </p>
      <Button type="button" className="w-full" onClick={() => setOpen(true)}>
        {t("defaultPrices.brands.assignOutlet", "Assign Outlet")}
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
      <AssignBrandOutletDialog
        open={open}
        onOpenChange={setOpen}
        selectedIds={selectedIds}
        onConfirm={onChange}
      />
    </section>
  );
}
