import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { ProductRecipeTargetProduct } from "../types";

export type ProductItemSelectProps = {
  products: ProductRecipeTargetProduct[];
  value: string;
  onChange: (productId: string) => void;
  disabled?: boolean;
};

export function ProductItemSelect({ products, value, onChange, disabled }: ProductItemSelectProps) {
  const { t } = useAppTranslation();

  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder={t("ingredient.productRecipe.selectItem", "Select an Item")} />
      </SelectTrigger>
      <SelectContent>
        {products.map((row) => (
          <SelectItem key={row.id} value={row.id}>
            {row.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
