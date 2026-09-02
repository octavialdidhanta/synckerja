import { useLocation } from "react-router-dom";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { catalogTabFromPathname } from "./DefaultPricesHeaderAndTab";

type Props = {
  count?: number;
};

function sectionCopy(pathname: string): { key: string; fallback: string } {
  switch (catalogTabFromPathname(pathname)) {
    case "products":
      return { key: "defaultPrices.tab.products", fallback: "Products" };
    case "bundles":
      return { key: "defaultPrices.nav.bundles", fallback: "Bundle Package" };
    case "categories":
      return { key: "defaultPrices.nav.categories", fallback: "Categories" };
    case "brands":
      return { key: "defaultPrices.nav.brands", fallback: "Brands" };
    case "modifiers":
      return { key: "defaultPrices.nav.modifiers", fallback: "Modifiers" };
    case "gratuity":
      return { key: "defaultPrices.nav.gratuity", fallback: "Gratuity" };
    case "discounts":
      return { key: "defaultPrices.nav.discounts", fallback: "Discounts" };
    case "promos":
      return { key: "defaultPrices.nav.promos", fallback: "Promos" };
    case "sales-types":
      return { key: "defaultPrices.nav.salesType", fallback: "Sales Type" };
    case "taxes":
      return { key: "defaultPrices.nav.taxes", fallback: "Taxes" };
    default:
      return { key: "defaultPrices.tab.services", fallback: "Services" };
  }
}

export function DefaultPricesPanelFooter({ count = 0 }: Props) {
  const { t } = useAppTranslation();
  const { pathname } = useLocation();
  const section = sectionCopy(pathname);
  const sectionLabel = t(section.key, section.fallback);

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t("defaultPrices.footer.showing", "Showing {{count}} {{section}}", {
            count,
            section: sectionLabel,
          })}
        </span>
        <span className="text-xs text-muted-foreground/80">
          {t("defaultPrices.footer.total", "Total: {{count}}", { count })}
        </span>
      </div>
    </div>
  );
}
