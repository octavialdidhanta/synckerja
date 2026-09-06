import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatIdIntegerGrouping } from "@/8-2-1-default-prices/utils/formatIdUnitPrice";
import type { VariantDraft } from "@/8-2-1-default-prices/product-variants/types";
import { AddProductVariantDialog } from "@/8-2-1-default-prices/product-variants";
import { cn } from "@/shared/lib/utils";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
import { POS_CASHIER_I18N } from "../../../../lib/posCashierCopy";

type Props = {
  variants: VariantDraft[];
  dialogOpen: boolean;
  onDialogOpenChange: (open: boolean) => void;
  onVariantsChange: (variants: VariantDraft[]) => void;
  disabled?: boolean;
};

/** Thin POS block: list draft variants + open BO AddProductVariantDialog. */
export function PosCreateItemVariantsBlock({
  variants,
  dialogOpen,
  onDialogOpenChange,
  onVariantsChange,
  disabled,
}: Props) {
  const { t } = useAppTranslation();

  return (
    <div>
      <p className={POS_PANEL.sectionTitle}>
        {t(POS_CASHIER_I18N.setupAddVariant, "Add Variant")}
      </p>
      <div className={POS_PANEL.card}>
        {variants.length > 0
          ? variants.map((row) => (
              <div key={row.id} className={POS_PANEL.row}>
                <span className={cn(POS_PANEL.rowLabel, "truncate")}>{row.name}</span>
                <span className={POS_PANEL.rowValue}>
                  Rp {row.priceDisplay || formatIdIntegerGrouping("0")}
                  {row.sku.trim() ? ` · ${row.sku.trim()}` : ""}
                </span>
              </div>
            ))
          : null}
        <div className="px-3 py-3">
          <Button
            type="button"
            className="h-11 w-full text-sm font-semibold"
            variant="default"
            disabled={disabled}
            onClick={() => onDialogOpenChange(true)}
          >
            {t(POS_CASHIER_I18N.setupAddVariant, "Add Variant")}
          </Button>
        </div>
      </div>
      <AddProductVariantDialog
        open={dialogOpen}
        onOpenChange={onDialogOpenChange}
        variants={variants}
        onConfirm={onVariantsChange}
      />
    </div>
  );
}
