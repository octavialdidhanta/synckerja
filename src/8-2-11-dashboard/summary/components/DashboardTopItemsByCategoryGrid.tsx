import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { DashboardTopItemsByCategory } from "../hooks/useDashboardItemSummary";

type Props = {
  categories: DashboardTopItemsByCategory[];
};

export function DashboardTopItemsByCategoryGrid({ categories }: Props) {
  const { t } = useAppTranslation();
  const populated = categories.filter((category) => category.items.length > 0);
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-foreground">
        {t("operationsDashboard.items.byCategory", "TOP ITEMS BY CATEGORY")}
      </h2>
      {populated.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
          {t("operationsDashboard.items.empty", "No item sales for this period.")}
        </div>
      ) : (
        <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
          {populated.map((category) => (
            <div key={category.categoryId ?? category.categoryName} className="rounded-lg border border-border bg-card p-3 shadow-sm">
              <h3 className="truncate text-sm font-medium text-foreground">{category.categoryName}</h3>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={category.items} layout="vertical" margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" domain={[0, "auto"]} fontSize={10} tickLine={false} />
                  <YAxis type="category" dataKey="itemName" width={90} fontSize={10} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="qtySold" name={t("operationsDashboard.items.sold", "Item Sold")} fill="#3B82F6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
