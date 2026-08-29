import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useCatalogProductCategories } from "@/8-2-1-default-prices/categories/hooks/useCatalogProductCategories";

export const GROSS_PROFIT_CATEGORY_ALL = "all";

type Props = {
  value: string | null;
  onChange: (categoryId: string | null) => void;
};

export function GrossProfitCategoryFilter({ value, onChange }: Props) {
  const { t } = useAppTranslation();
  const { rows: categories = [] } = useCatalogProductCategories();

  return (
    <Select
      value={value ?? GROSS_PROFIT_CATEGORY_ALL}
      onValueChange={(next) => {
        onChange(next === GROSS_PROFIT_CATEGORY_ALL ? null : next);
      }}
    >
      <SelectTrigger className="h-9 w-[180px] shrink-0" aria-label={t(
        "reports.grossProfit.items.categoryFilter",
        "Category",
      )}>
        <SelectValue
          placeholder={t("reports.grossProfit.items.allCategories", "All categories")}
        />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={GROSS_PROFIT_CATEGORY_ALL}>
          {t("reports.grossProfit.items.allCategories", "All categories")}
        </SelectItem>
        {categories.map((cat) => (
          <SelectItem key={cat.id} value={cat.id}>
            {cat.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
