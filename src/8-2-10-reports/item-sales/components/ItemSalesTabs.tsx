import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { ItemSalesTab } from "../lib/itemSalesTypes";

type Props = {
  activeTab: ItemSalesTab;
  onChange: (tab: ItemSalesTab) => void;
};

export function ItemSalesTabs({ activeTab, onChange }: Props) {
  const { t } = useAppTranslation();

  const tabs: { id: ItemSalesTab; label: string }[] = [
    { id: "income", label: t("reports.itemSales.tabIncome", "Income") },
    { id: "quantity", label: t("reports.itemSales.tabQuantity", "Quantity") },
  ];

  return (
    <div className="mb-4">
      <div className="mb-3 flex gap-6 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "-mb-px border-b-2 pb-2 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {activeTab === "income"
          ? t(
              "reports.itemSales.subtitle",
              "See how a la carte items and bundle packages contribute to the profit and margin for your business.",
            )
          : t(
              "reports.itemSales.quantitySubtitle",
              "See how many items have been sold. You can also compare quantity between a la carte and bundle package.",
            )}
      </p>
    </div>
  );
}
