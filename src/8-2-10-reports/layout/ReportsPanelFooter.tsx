import { useLocation } from "react-router-dom";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  reportsSalesNavFromPathname,
  reportsTabFromPathname,
  type ReportsSalesNavId,
} from "./reportsTabs";

type Props = {
  count?: number;
};

const SALES_NAV_COPY: Record<ReportsSalesNavId, { key: string; fallback: string }> = {
  summary: { key: "reports.salesNav.summary", fallback: "Sales Summary" },
  "gross-profit": { key: "reports.salesNav.grossProfit", fallback: "Gross Profit" },
  "payment-methods": { key: "reports.salesNav.paymentMethods", fallback: "Payment Methods" },
  "sales-type": { key: "reports.salesNav.salesType", fallback: "Sales Type" },
  "item-sales": { key: "reports.salesNav.itemSales", fallback: "Item Sales" },
  "category-sales": { key: "reports.salesNav.categorySales", fallback: "Category Sales" },
  "brand-sales": { key: "reports.salesNav.brandSales", fallback: "Brand Sales" },
  "modifier-sales": { key: "reports.salesNav.modifierSales", fallback: "Modifier Sales" },
  discounts: { key: "reports.salesNav.discounts", fallback: "Discounts" },
  taxes: { key: "reports.salesNav.taxes", fallback: "Taxes" },
  gratuity: { key: "reports.salesNav.gratuity", fallback: "Gratuity" },
  "collected-by": { key: "reports.salesNav.collectedBy", fallback: "Collected By" },
  "served-by": { key: "reports.salesNav.servedBy", fallback: "Served By" },
};

function sectionCopy(pathname: string): { key: string; fallback: string } {
  const tab = reportsTabFromPathname(pathname);
  if (tab === "transactions") return { key: "reports.tab.transactions", fallback: "Transactions" };
  if (tab === "invoices") return { key: "reports.tab.invoices", fallback: "Invoices" };
  if (tab === "shift") return { key: "reports.tab.shift", fallback: "Shift" };
  return SALES_NAV_COPY[reportsSalesNavFromPathname(pathname)];
}

export function ReportsPanelFooter({ count = 0 }: Props) {
  const { t } = useAppTranslation();
  const { pathname } = useLocation();
  const section = sectionCopy(pathname);
  const sectionLabel = t(section.key, section.fallback);

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t("reports.footer.showing", "Showing {{count}} {{section}}", {
            count,
            section: sectionLabel,
          })}
        </span>
        <span className="text-xs text-muted-foreground/80">
          {t("reports.footer.total", "Total: {{count}}", { count })}
        </span>
      </div>
    </div>
  );
}
