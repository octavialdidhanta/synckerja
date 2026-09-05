import type { ItemSalesRow } from "@/8-2-10-reports/item-sales/lib/itemSalesTypes";
import { formatSalesSummaryMoney } from "@/8-2-10-reports/sales-summary/lib/computeSalesSummaryDisplay";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

type Props = {
  items: ItemSalesRow[];
};

export function DashboardTopItemsTable({ items }: Props) {
  const { t } = useAppTranslation();
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="border-b border-border p-4">
        <h2 className="text-sm font-semibold text-foreground">
          {t("operationsDashboard.items.topItems", "TOP 10 ITEMS")}
        </h2>
      </div>
      {items.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">
          {t("operationsDashboard.items.empty", "No item sales for this period.")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t("operationsDashboard.items.item", "Item")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("operationsDashboard.items.sold", "Item Sold")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("operationsDashboard.cards.grossSales", "Gross Sales")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("operationsDashboard.cards.netSales", "Net Sales")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("operationsDashboard.cards.grossProfit", "Gross Profit")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr key={`${item.catalogProductId ?? item.itemName}:${item.catalogVariantId ?? ""}`}>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {item.itemName}{item.variantName ? ` · ${item.variantName}` : ""}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{item.qtySold.toLocaleString("id-ID")}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatSalesSummaryMoney(item.grossSales)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatSalesSummaryMoney(item.netSales)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatSalesSummaryMoney(item.grossProfit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
