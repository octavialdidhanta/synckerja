import { useCallback, useState } from "react";
import { Badge, Folders, Layers, Lock, Megaphone, Package, PanelLeftClose, PanelLeftOpen, Percent, Receipt, Tag, TicketPercent, UtensilsCrossed } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useHeaderTabPageAccess } from "@/shared/auth/page-access/useHeaderTabPageAccess";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import {
  LIBRARY_BRANDS_PATH,
  LIBRARY_BUNDLES_PATH,
  LIBRARY_CATEGORIES_PATH,
  LIBRARY_DISCOUNTS_PATH,
  LIBRARY_GRATUITY_PATH,
  LIBRARY_MODIFIERS_PATH,
  LIBRARY_PRODUCTS_PATH,
  LIBRARY_PROMOS_PATH,
  LIBRARY_SALES_TYPES_PATH,
  LIBRARY_SERVICES_PATH,
  LIBRARY_TAXES_PATH,
} from "../layout/DefaultPricesHeaderAndTab";

const COLLAPSED_STORAGE_KEY = "synckerja.library-item-nav.collapsed";

function readCollapsedPreference(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function LibraryItemNav() {
  const { t } = useAppTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { isTabLocked } = useHeaderTabPageAccess();
  const [collapsed, setCollapsed] = useState(readCollapsedPreference);
  const sectionLabel = t("defaultPrices.nav.itemLibrary", "Item Library");
  const collapseLabel = t("defaultPrices.nav.collapse", "Collapse library nav");
  const expandLabel = t("defaultPrices.nav.expand", "Expand library nav");
  const noAccess = t("defaultPrices.header.noAccess", "Anda tidak memiliki akses ke halaman ini");

  const items = [
    {
      id: "item-library" as const,
      path: LIBRARY_SERVICES_PATH,
      label: t("defaultPrices.nav.itemLibrary", "Item Library"),
      icon: Tag,
      active:
        location.pathname.startsWith(LIBRARY_SERVICES_PATH) ||
        location.pathname.startsWith(LIBRARY_PRODUCTS_PATH),
      locked: isTabLocked(LIBRARY_SERVICES_PATH),
    },
    {
      id: "bundles" as const,
      path: LIBRARY_BUNDLES_PATH,
      label: t("defaultPrices.nav.bundles", "Bundle Package"),
      icon: Package,
      active: location.pathname.startsWith(LIBRARY_BUNDLES_PATH),
      locked: isTabLocked(LIBRARY_BUNDLES_PATH),
    },
    {
      id: "categories" as const,
      path: LIBRARY_CATEGORIES_PATH,
      label: t("defaultPrices.nav.categories", "Categories"),
      icon: Folders,
      active: location.pathname.startsWith(LIBRARY_CATEGORIES_PATH),
      locked: isTabLocked(LIBRARY_CATEGORIES_PATH),
    },
    {
      id: "modifiers" as const,
      path: LIBRARY_MODIFIERS_PATH,
      label: t("defaultPrices.nav.modifiers", "Modifiers"),
      icon: Layers,
      active: location.pathname.startsWith(LIBRARY_MODIFIERS_PATH),
      locked: isTabLocked(LIBRARY_MODIFIERS_PATH),
    },
    {
      id: "gratuity" as const,
      path: LIBRARY_GRATUITY_PATH,
      label: t("defaultPrices.nav.gratuity", "Gratuity"),
      icon: Percent,
      active: location.pathname.startsWith(LIBRARY_GRATUITY_PATH),
      locked: isTabLocked(LIBRARY_GRATUITY_PATH),
    },
    {
      id: "discounts" as const,
      path: LIBRARY_DISCOUNTS_PATH,
      label: t("defaultPrices.nav.discounts", "Discounts"),
      icon: TicketPercent,
      active: location.pathname.startsWith(LIBRARY_DISCOUNTS_PATH),
      locked: isTabLocked(LIBRARY_DISCOUNTS_PATH),
    },
    {
      id: "promos" as const,
      path: LIBRARY_PROMOS_PATH,
      label: t("defaultPrices.nav.promos", "Promos"),
      icon: Megaphone,
      active: location.pathname.startsWith(LIBRARY_PROMOS_PATH),
      locked: isTabLocked(LIBRARY_PROMOS_PATH),
    },
    {
      id: "sales-types" as const,
      path: LIBRARY_SALES_TYPES_PATH,
      label: t("defaultPrices.nav.salesType", "Sales Type"),
      icon: UtensilsCrossed,
      active: location.pathname.startsWith(LIBRARY_SALES_TYPES_PATH),
      locked: isTabLocked(LIBRARY_SALES_TYPES_PATH),
    },
    {
      id: "brands" as const,
      path: LIBRARY_BRANDS_PATH,
      label: t("defaultPrices.nav.brands", "Brands"),
      icon: Badge,
      active: location.pathname.startsWith(LIBRARY_BRANDS_PATH),
      locked: isTabLocked(LIBRARY_BRANDS_PATH),
    },
    {
      id: "taxes" as const,
      path: LIBRARY_TAXES_PATH,
      label: t("defaultPrices.nav.taxes", "Taxes"),
      icon: Receipt,
      active: location.pathname.startsWith(LIBRARY_TAXES_PATH),
      locked: isTabLocked(LIBRARY_TAXES_PATH),
    },
  ];

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
    const outlet = new URLSearchParams(location.search).get("outlet");
    if (outlet) {
      navigate({ pathname: path, search: `?outlet=${encodeURIComponent(outlet)}` });
      return;
    }
    navigate(path);
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
