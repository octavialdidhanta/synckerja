import { useCallback, useState } from "react";
import { Lock, PanelLeftClose, PanelLeftOpen, ShoppingCart, Store } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useHeaderTabPageAccess } from "@/shared/auth/page-access/useHeaderTabPageAccess";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { OUTLETS_LIST_PATH, SETTINGS_CHECKOUT_PATH } from "../layout/OutletsHeaderAndTab";

const COLLAPSED_STORAGE_KEY = "synckerja.settings-item-nav.collapsed";

function readCollapsedPreference(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function SettingsItemNav() {
  const { t } = useAppTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { isTabLocked } = useHeaderTabPageAccess();
  const [collapsed, setCollapsed] = useState(readCollapsedPreference);
  const sectionLabel = t("outlets.nav.section", "Settings");
  const collapseLabel = t("outlets.nav.collapse", "Collapse settings nav");
  const expandLabel = t("outlets.nav.expand", "Expand settings nav");
  const noAccess = t("defaultPrices.header.noAccess", "Anda tidak memiliki akses ke halaman ini");

  const items = [
    {
      id: "outlet" as const,
      path: OUTLETS_LIST_PATH,
      label: t("outlets.nav.outlet", "Outlet"),
      icon: Store,
      active: location.pathname.startsWith(OUTLETS_LIST_PATH),
      locked: isTabLocked(OUTLETS_LIST_PATH),
    },
    {
      id: "checkout" as const,
      path: SETTINGS_CHECKOUT_PATH,
      label: t("outlets.nav.checkout", "Checkout"),
      icon: ShoppingCart,
      active: location.pathname.startsWith(SETTINGS_CHECKOUT_PATH),
      locked: isTabLocked(SETTINGS_CHECKOUT_PATH),
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
