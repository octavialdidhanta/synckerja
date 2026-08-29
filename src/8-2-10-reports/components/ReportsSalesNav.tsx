import { useCallback, useState } from "react";
import {
  Banknote,
  BarChart3,
  Folders,
  HandCoins,
  Layers,
  Lock,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Percent,
  Receipt,
  Tag,
  TicketPercent,
  UserRound,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useHeaderTabPageAccess } from "@/shared/auth/page-access/useHeaderTabPageAccess";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import {
  REPORTS_SALES_NAV_PATHS,
  reportsSalesNavFromPathname,
  type ReportsSalesNavId,
} from "../layout/reportsTabs";

const COLLAPSED_STORAGE_KEY = "synckerja.reports-sales-nav.collapsed";

function readCollapsedPreference(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

const NAV_ITEMS: Array<{
  id: ReportsSalesNavId;
  titleKey: string;
  fallbackTitle: string;
  icon: typeof BarChart3;
}> = [
  {
    id: "summary",
    titleKey: "reports.salesNav.summary",
    fallbackTitle: "Sales Summary",
    icon: BarChart3,
  },
  {
    id: "gross-profit",
    titleKey: "reports.salesNav.grossProfit",
    fallbackTitle: "Gross Profit",
    icon: Wallet,
  },
  {
    id: "payment-methods",
    titleKey: "reports.salesNav.paymentMethods",
    fallbackTitle: "Payment Methods",
    icon: Banknote,
  },
  {
    id: "sales-type",
    titleKey: "reports.salesNav.salesType",
    fallbackTitle: "Sales Type",
    icon: UtensilsCrossed,
  },
  {
    id: "item-sales",
    titleKey: "reports.salesNav.itemSales",
    fallbackTitle: "Item Sales",
    icon: Tag,
  },
  {
    id: "category-sales",
    titleKey: "reports.salesNav.categorySales",
    fallbackTitle: "Category Sales",
    icon: Folders,
  },
  {
    id: "brand-sales",
    titleKey: "reports.salesNav.brandSales",
    fallbackTitle: "Brand Sales",
    icon: Package,
  },
  {
    id: "modifier-sales",
    titleKey: "reports.salesNav.modifierSales",
    fallbackTitle: "Modifier Sales",
    icon: Layers,
  },
  {
    id: "discounts",
    titleKey: "reports.salesNav.discounts",
    fallbackTitle: "Discounts",
    icon: TicketPercent,
  },
  {
    id: "taxes",
    titleKey: "reports.salesNav.taxes",
    fallbackTitle: "Taxes",
    icon: Receipt,
  },
  {
    id: "gratuity",
    titleKey: "reports.salesNav.gratuity",
    fallbackTitle: "Gratuity",
    icon: Percent,
  },
  {
    id: "collected-by",
    titleKey: "reports.salesNav.collectedBy",
    fallbackTitle: "Collected By",
    icon: HandCoins,
  },
  {
    id: "served-by",
    titleKey: "reports.salesNav.servedBy",
    fallbackTitle: "Served By",
    icon: UserRound,
  },
];

/** Left rail for Sales reports — same chrome as Library `LibraryItemNav`. */
export function ReportsSalesNav() {
  const { t } = useAppTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { isTabLocked } = useHeaderTabPageAccess();
  const [collapsed, setCollapsed] = useState(readCollapsedPreference);
  const activeId = reportsSalesNavFromPathname(location.pathname);
  const sectionLabel = t("reports.salesNav.section", "Sales");
  const collapseLabel = t("reports.salesNav.collapse", "Collapse sales report nav");
  const expandLabel = t("reports.salesNav.expand", "Expand sales report nav");
  const noAccess = t("reports.header.noAccess", "You do not have access to this page");

  const items = NAV_ITEMS.map((item) => {
    const path = REPORTS_SALES_NAV_PATHS[item.id];
    return {
      ...item,
      path,
      label: t(item.titleKey, item.fallbackTitle),
      active: activeId === item.id,
      locked: isTabLocked(path) || isTabLocked(REPORTS_SALES_NAV_PATHS.summary),
    };
  });

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const goTo = (path: string, locked: boolean) => {
    if (locked) return;
    navigate({ pathname: path, search: location.search });
  };

  return (
    <div
      className={cn(
        "flex h-full shrink-0 flex-col overflow-hidden border-r border-gray-200 bg-gray-50/80 transition-[width] duration-200 ease-in-out",
        collapsed ? "w-14" : "w-[180px]",
      )}
    >
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto",
          collapsed ? "flex flex-col items-center gap-1 px-1 py-2" : "border-b border-gray-200/80 px-3 py-3",
        )}
      >
        {collapsed ? (
          <>
            <button
              type="button"
              onClick={toggleCollapsed}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-gray-100 hover:text-foreground"
              aria-label={expandLabel}
              title={expandLabel}
            >
              <PanelLeftOpen className="h-4 w-4 shrink-0" aria-hidden />
            </button>
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => goTo(item.path, item.locked)}
                  title={item.locked ? noAccess : item.label}
                  aria-label={item.label}
                  className={cn(
                    "relative inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors",
                    item.locked
                      ? "cursor-not-allowed text-muted-foreground opacity-60"
                      : item.active
                        ? "bg-gray-200/80 text-gray-900"
                        : "text-gray-700 hover:bg-gray-100",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {item.locked ? (
                    <Lock className="absolute bottom-0.5 right-0.5 h-3 w-3" aria-hidden />
                  ) : null}
                </button>
              );
            })}
          </>
        ) : (
          <>
            <div className="mb-1 flex items-center justify-between gap-1">
              <p className="px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {sectionLabel}
              </p>
              <button
                type="button"
                onClick={toggleCollapsed}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-gray-100 hover:text-foreground"
                aria-label={collapseLabel}
                title={collapseLabel}
              >
                <PanelLeftClose className="h-4 w-4 shrink-0" aria-hidden />
              </button>
            </div>
            <div className="space-y-1">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => goTo(item.path, item.locked)}
                    title={item.locked ? noAccess : item.label}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                      item.locked
                        ? "cursor-not-allowed text-muted-foreground opacity-60"
                        : item.active
                          ? "bg-gray-200/80 font-medium text-gray-900"
                          : "text-gray-700 hover:bg-gray-100",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate">{item.label}</span>
                    {item.locked ? <Lock className="ml-auto h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
