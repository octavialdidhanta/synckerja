import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { usePosOutlets } from "@/8-2-2-outlets/hooks/usePosOutlets";
import { summarizeAssignedOutlets } from "@/8-2-2-outlets/lib/assignedOutlets";
import { AssignProductOutletDialog } from "./AssignProductOutletDialog";
import { FieldInfoTip } from "../../components/FieldInfoTip";

export type ProductOutletsSectionProps = {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  embedded?: boolean;
};

export function ProductOutletsSection({ selectedIds, onChange, embedded }: ProductOutletsSectionProps) {
  const { t } = useAppTranslation();
  const { rows } = usePosOutlets();
  const [open, setOpen] = useState(false);
  const summary = summarizeAssignedOutlets(rows, selectedIds);

  return (
    <section className={embedded ? "space-y-2" : "space-y-3 rounded-lg border p-4"}>
      <div className="flex items-center gap-1.5">
        <h3 className="text-sm font-medium">
          {t("defaultPrices.product.outletsSection", "Assigned Outlets")}
        </h3>
        <FieldInfoTip
          text={t(
            "defaultPrices.product.outletsHint",
            "Select outlets that sell this product",
          )}
        />
      </div>
      <Button type="button" className="w-full" onClick={() => setOpen(true)}>
        {t("defaultPrices.product.assignOutlet", "Assign Outlet")}
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
      <AssignProductOutletDialog
        open={open}
        onOpenChange={setOpen}
        selectedIds={selectedIds}
        onConfirm={onChange}
      />
    </section>
  );
}
