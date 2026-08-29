import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  LIBRARY_CATEGORIES_PATH,
  LIBRARY_PRODUCTS_PATH,
} from "@/8-2-1-default-prices/layout/DefaultPricesHeaderAndTab";
import { Button } from "@/shared/components/ui/button";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { CATEGORY_SALES_COGS_DISMISS_STORAGE_PREFIX } from "../lib/categorySalesTypes";

type Props = {
  visible: boolean;
  outletQuery: string;
};

function readDismissed(orgId: string | null): boolean {
  if (!orgId || typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(`${CATEGORY_SALES_COGS_DISMISS_STORAGE_PREFIX}${orgId}`) === "1";
  } catch {
    return false;
  }
}

function writeDismissed(orgId: string | null): void {
  if (!orgId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${CATEGORY_SALES_COGS_DISMISS_STORAGE_PREFIX}${orgId}`, "1");
  } catch {
    /* ignore quota errors */
  }
}

export function CategorySalesCogsCallout({ visible, outletQuery }: Props) {
  const { t } = useAppTranslation();
  const { organizationId } = useCurrentOrg();
  const [dismissed, setDismissed] = useState(() => readDismissed(organizationId));

  useEffect(() => {
    setDismissed(readDismissed(organizationId));
  }, [organizationId]);

  if (!visible || dismissed) return null;

  const handleDismiss = () => {
    writeDismissed(organizationId);
    setDismissed(true);
  };

  return (
    <div className="relative mb-3 overflow-hidden rounded-md border border-border border-t-4 border-t-primary bg-background px-4 py-3 pr-10 shadow-sm">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-1 top-1 h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={handleDismiss}
        aria-label={t("reports.categorySales.cogsDismiss", "Dismiss")}
      >
        <X className="h-4 w-4" aria-hidden />
      </Button>
      <p className="text-sm font-semibold text-foreground">
        {t("reports.categorySales.cogsTitle", "Gross Profit")}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {t(
          "reports.categorySales.cogsBody",
          "Fill COGS on products in Item Library for accurate gross profit by category.",
        )}
      </p>
      <p className="mt-2 flex flex-wrap items-center gap-3 text-sm">
        <Link
          to={`${LIBRARY_PRODUCTS_PATH}?outlet=${outletQuery}`}
          className="font-medium text-primary hover:underline"
        >
          {t("reports.categorySales.linkItemLibrary", "Item Library")}
        </Link>
        <span className="text-muted-foreground" aria-hidden>
          ·
        </span>
        <Link
          to={`${LIBRARY_CATEGORIES_PATH}?outlet=${outletQuery}`}
          className="font-medium text-primary hover:underline"
        >
          {t("reports.categorySales.linkCategories", "Categories")}
        </Link>
      </p>
    </div>
  );
}
