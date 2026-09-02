import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { CategoryLayout } from "@/synckerja-order/shared/lib/orderCategoryLayout";

type Props = {
  value: CategoryLayout;
  onChange: (layout: CategoryLayout) => void;
  disabled?: boolean;
};

export function CategoryLayoutPicker({ value, onChange, disabled }: Props) {
  const { t } = useAppTranslation();
  const options: Array<{ id: CategoryLayout; label: string; fallback: string }> = [
    { id: "list", label: "synckerjaOrder.catalog.layoutList", fallback: "List" },
    { id: "slider_bleed", label: "synckerjaOrder.catalog.layoutSlider", fallback: "Slider" },
    { id: "grid_2col", label: "synckerjaOrder.catalog.layoutGrid", fallback: "Grid" },
  ];

  return (
    <div className="inline-flex flex-wrap rounded-md border border-border p-0.5">
      {options.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.id)}
            className={`rounded px-2 py-1 text-[11px] font-medium sm:px-2.5 sm:text-xs ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            } disabled:opacity-60`}
          >
            {t(option.label, option.fallback)}
          </button>
        );
      })}
    </div>
  );
}
