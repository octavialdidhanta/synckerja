import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { ProductRecipeVariantOption } from "../types";

const BASE_VARIANT_VALUE = "__base__";

export type VariantOptionSelectProps = {
  options: ProductRecipeVariantOption[];
  value: string | null;
  onChange: (modifierOptionId: string | null) => void;
  disabled?: boolean;
  hidden?: boolean;
};

export function VariantOptionSelect({
  options,
  value,
  onChange,
  disabled,
  hidden,
}: VariantOptionSelectProps) {
  const { t } = useAppTranslation();

  if (hidden || options.length === 0) return null;

  const selectValue = value ?? BASE_VARIANT_VALUE;

  return (
    <Select
      value={selectValue}
      onValueChange={(next) => onChange(next === BASE_VARIANT_VALUE ? null : next)}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder={t("ingredient.productRecipe.selectVariant", "Variant Option")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={BASE_VARIANT_VALUE}>
          {t("ingredient.productRecipe.baseVariant", "Base product (no variant)")}
        </SelectItem>
        {options.map((row) => (
          <SelectItem key={row.id} value={row.id}>
            {row.group_name ? `${row.group_name}: ${row.name}` : row.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
