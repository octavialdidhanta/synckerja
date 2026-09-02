import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

type CategoryOption = {
  id: string;
  name: string;
};

type Props = {
  categories: CategoryOption[];
  pairings: Record<string, string>;
  disabled?: boolean;
  onChange: (fromCategoryId: string, toCategoryId: string | null) => void;
};

export function RelatedMenuPairingSection({ categories, pairings, disabled, onChange }: Props) {
  const { t } = useAppTranslation();
  if (categories.length === 0) return null;

  return (
    <section className="rounded-md border border-border">
      <div className="border-b px-3 py-2">
        <p className="text-sm font-medium">
          {t("synckerjaOrder.catalog.relatedMenu", "Related menu")}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t(
            "synckerjaOrder.catalog.relatedMenuHint",
            "When a guest checks out items from a category, suggest items from the paired category.",
          )}
        </p>
      </div>
      <div className="space-y-2 p-3">
        {categories.map((category) => (
          <label key={category.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
            <span className="min-w-0 flex-1 truncate text-sm">{category.name}</span>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm sm:w-56"
              disabled={disabled}
              value={pairings[category.id] ?? ""}
              onChange={(e) => onChange(category.id, e.target.value || null)}
            >
              <option value="">
                {t("synckerjaOrder.catalog.relatedMenuNone", "No suggestion")}
              </option>
              {categories
                .filter((other) => other.id !== category.id)
                .map((other) => (
                  <option key={other.id} value={other.id}>
                    {other.name}
                  </option>
                ))}
            </select>
          </label>
        ))}
      </div>
    </section>
  );
}
