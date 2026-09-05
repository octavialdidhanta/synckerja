import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatIdIntegerGrouping } from "@/8-2-1-default-prices/utils/formatIdUnitPrice";
import type { VariantDraft } from "@/8-2-1-default-prices/product-variants/types";
import { AddProductVariantDialog } from "@/8-2-1-default-prices/product-variants";
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
    <div className="space-y-2">
      {variants.length > 0 ? (
        <ul className="space-y-1.5 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
          {variants.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-2 text-sm text-slate-800"
            >
              <span className="min-w-0 truncate font-medium">{row.name}</span>
              <span className="shrink-0 tabular-nums text-slate-600">
                Rp {row.priceDisplay || formatIdIntegerGrouping("0")}
                {row.sku.trim() ? ` · ${row.sku.trim()}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <Button
        type="button"
        className="h-11 w-full"
        variant="default"
        disabled={disabled}
        onClick={() => onDialogOpenChange(true)}
      >
        {t(POS_CASHIER_I18N.setupAddVariant, "Add Variant")}
      </Button>
      <AddProductVariantDialog
        open={dialogOpen}
        onOpenChange={onDialogOpenChange}
        variants={variants}
        onConfirm={onVariantsChange}
      />
    </div>
  );
}
