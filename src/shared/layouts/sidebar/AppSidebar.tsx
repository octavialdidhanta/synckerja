import { useEffect, useMemo, useRef, useState, type TransitionEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight, Lock } from "lucide-react";
import { Sidebar, SidebarContent, useSidebar } from "@/shared/components/ui/sidebar";
import { cn } from "@/shared/lib/utils";
import {
  mainNavItems,
  pathBaseFromNavPath,
  isNavSubItemActive,
  type MainNavItem,
  type NavSubItem,
} from "./navConfig";
import { useSidebarState } from "./useSidebarState";
import { useSubscriptionSelfServiceEnabled } from "@/shared/auth/hooks/useSubscriptionSelfServiceEnabled";
import { useEffectiveModuleAccess } from "@/shared/auth/hooks/useEffectiveModuleAccess";
import type { SalesModuleKey } from "@/shared/auth/module-access/moduleCatalog";
import { LiveChatAppBadgeSync } from "@/5-3-whatsapp/components/LiveChatAppBadgeSync";
import { SYNCKERJA_BRAND_LOGO_SRC } from "@/shared/brand/brandLogo";
import { prefetchAppRoute } from "@/shared/routing/prefetchAppRoute";

interface SubSidebarPanelProps {
  items: NavSubItem[];
  titleKey: string;
}

/** Logo + label: same `/pwa-192.png` expanded/collapsed; label animates when rail expands (mobile sheet always shows label). */
function SidebarBrandHeader() {
  const { t } = useTranslation();
  const { state, isMobile } = useSidebar();
  const showBrandText = isMobile || state === "expanded";

  return (
    <div className="flex min-h-[3.25rem] shrink-0 items-center border-b border-slate-300 px-2 py-2 dark:border-slate-600">
      <Link
        to="/"
        className={cn(
          "flex h-full min-h-0 w-full min-w-0 items-center overflow-hidden rounded-lg px-1 py-0 outline-none ring-offset-background",
          "transition-[justify-content] duration-300 ease-out motion-reduce:transition-none",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          showBrandText ? "justify-start" : "justify-center",
        )}
      >
        <img
          src={SYNCKERJA_BRAND_LOGO_SRC}
          alt={t("layout.appName")}
          width={192}
          height={192}
          loading="eager"
          decoding="sync"
          draggable={false}
          className={cn(
            "shrink-0 object-contain select-none transform-gpu",
            "transition-[width,height] duration-300 ease-out motion-reduce:transition-none",
            // Icon rail: sedikit lebih besar saat collapse agar downscale dari 192px lebih tajam di DPR tinggi
            showBrandText ? "h-8 w-8" : "h-9 w-9 max-h-[2.75rem] max-w-[2.75rem]",
          )}
          sizes={showBrandText ? "32px" : "40px"}
        />
        <span
          aria-hidden
          className={cn(
            "select-none truncate text-sm font-semibold leading-none tracking-tight text-foreground",
            "transition-[max-width,opacity,transform,margin] duration-300 ease-out motion-reduce:transition-none",
            showBrandText
              ? "ml-2 max-w-[min(14rem,calc(100%-2.5rem))] translate-x-0 opacity-100"
              : "ml-0 max-w-0 -translate-x-2 opacity-0 overflow-hidden",
          )}
        >
          {t("layout.appName")}
        </span>
      </Link>
    </div>
  );
}

function SubSidebarPanel({ items, titleKey }: SubSidebarPanelProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const resolvedTitle = t(titleKey);

  return (
    <div
      className="h-full w-64 overflow-hidden bg-card font-sans antialiased"
      style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
    >
      <div className="box-border flex h-full w-64 flex-col border-r border-slate-200 bg-card dark:border-slate-700/60">
        <div className="box-border flex min-h-[3.25rem] shrink-0 items-center border-b border-slate-300 bg-muted/40 px-4 py-2 dark:border-slate-600">
          <h3 className="truncate text-sm font-semibold leading-none text-foreground">{resolvedTitle}</h3>
        </div>
        <div className="flex-1 overflow-y-auto seamless-scroll pt-2">
          <nav className="space-y-0">
            {items.map((item) => {
              const isActive = isNavSubItemActive(item, location.pathname, location.search);

              return (
                <button
                  key={`${item.titleKey}-${item.path}`}
                  type="button"
                  onMouseEnter={() => prefetchAppRoute(item.path)}
                  onFocus={() => prefetchAppRoute(item.path)}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    "group relative flex w-full transform-none items-center gap-3 px-4 py-3 text-left text-[15px] font-normal transition-colors duration-200",
                    isActive
                      ? "bg-brand-blue/10 text-brand-blue"
                      : "text-foreground hover:bg-brand-blue/10 hover:text-brand-blue",
                  )}
                  style={{
                    fontFamily: "system-ui, -apple-system, sans-serif",
                    letterSpacing: "-0.01em",
                  }}
                >
                  <div
                    className={cn(
                      "h-0.5 w-0.5 flex-shrink-0 rounded-full transition-colors duration-200",
                      isActive ? "bg-brand-blue" : "bg-muted-foreground/60 group-hover:bg-brand-blue/80",
                    )}
                  />
                  <span className="flex-1 truncate">{t(item.titleKey)}</span>
                  {isActive && (
                    <div className="absolute bottom-0 left-0 top-0 w-1 bg-brand-blue" aria-hidden />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const currentPath = location.pathname;
  const selfServiceEnabled = useSubscriptionSelfServiceEnabled();
  const { isModuleGatingActive, isModuleEnabled } = useEffectiveModuleAccess();

  const isNavModuleLocked = (itemId: string) => {
    if (!isModuleGatingActive || itemId === "dashboard" || itemId === "subscription") return false;
    return !isModuleEnabled(itemId as SalesModuleKey);
  };

  const visibleNavItems = useMemo(
    () =>
      selfServiceEnabled ? mainNavItems : mainNavItems.filter((item) => item.id !== "subscription"),
    [selfServiceEnabled],
  );

  const {
    activeSubSidebar,
    handleMouseEnter,
    handleMouseLeave,
    handleMenuItemHover,
    handleSubSidebarMouseEnter,
    handleSubSidebarMouseLeave,
  } = useSidebarState();

  const subSidebarPanelRef = useRef<HTMLDivElement | null>(null);

  const activeMenuItem = visibleNavItems.find(
    (item) => item.id === activeSubSidebar && item.subItems && item.subItems.length > 0,
  );
  const subSidebarOpen = Boolean(activeSubSidebar && activeMenuItem);

  const [subSidebarPaintOpen, setSubSidebarPaintOpen] = useState(false);
  const prevSubSidebarOpenRef = useRef(false);

  useEffect(() => {
    if (!subSidebarOpen) {
      setSubSidebarPaintOpen(false);
      prevSubSidebarOpenRef.current = false;
      return;
    }

    const wasAlreadyOpen = prevSubSidebarOpenRef.current;
    prevSubSidebarOpenRef.current = true;

    if (!wasAlreadyOpen) {
      setSubSidebarPaintOpen(false);
      let rafId = 0;
      let cancelled = false;
      rafId = requestAnimationFrame(() => {
        if (!cancelled) setSubSidebarPaintOpen(true);
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(rafId);
      };
    }

    setSubSidebarPaintOpen(true);
  }, [subSidebarOpen]);

  const subSidebarMeasuredOpen = subSidebarOpen && subSidebarPaintOpen;

  /** Avoid aria-hidden on sub-panel while a descendant button still has focus (browser a11y warning). */
  useEffect(() => {
    if (subSidebarOpen) return;
    const active = document.activeElement;
    if (
      active &&
      active instanceof HTMLElement &&
      subSidebarPanelRef.current?.contains(active)
    ) {
      active.blur();
    }
  }, [subSidebarOpen]);

  const [subMenuSnapshot, setSubMenuSnapshot] = useState<MainNavItem | null>(null);
  useEffect(() => {
    if (activeMenuItem) {
      setSubMenuSnapshot(activeMenuItem);
    }
  }, [activeMenuItem]);

  const panelContentMenu =
    activeMenuItem ??
    (subMenuSnapshot?.subItems && subMenuSnapshot.subItems.length > 0 ? subMenuSnapshot : null);

  useEffect(() => {
    if (!panelContentMenu?.subItems?.length) return;
    const timer = window.setTimeout(() => {
      for (const sub of panelContentMenu.subItems!) {
        prefetchAppRoute(sub.path);
      }
    }, 320);
    return () => window.clearTimeout(timer);
  }, [panelContentMenu?.id]);

  const handleSubSidebarPanelTransitionEnd = (e: TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.propertyName !== "width") return;
    if (!subSidebarOpen && !subSidebarPaintOpen) {
      setSubMenuSnapshot(null);
    }
  };

  const isParentActive = (item: MainNavItem) => {
    if (item.activePathPrefix) {
      const p = item.activePathPrefix;
      if (currentPath === p || currentPath.startsWith(`${p}/`)) return true;
    }
    if (item.activePathPrefixes?.length) {
      const extra = item.activePathPrefixes.some(
        (p) => currentPath === p || currentPath.startsWith(`${p}/`),
      );
      if (extra) return true;
    }
    if (item.path && item.path !== "#") {
      const mainActive =
        item.path === "/" ? currentPath === "/" : currentPath.startsWith(item.path);
      if (mainActive) return true;
    }
    return Boolean(
      item.subItems?.some((sub) => {
        if (sub.highlightsParent === false) return false;
        const base = pathBaseFromNavPath(sub.path);
        const subMatch =
          base === "/"
            ? currentPath === "/"
            : currentPath === base || currentPath.startsWith(`${base}/`);
        const extra = sub.activePathPrefixes?.some(
          (p) => currentPath === p || currentPath.startsWith(`${p}/`),
        );
        return subMatch || Boolean(extra);
      }),
    );
  };

  return (
    <div className="relative flex h-full">
      <LiveChatAppBadgeSync />
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="group relative z-40 h-[calc(100vh-4rem)] shrink-0"
      >
        <Sidebar
          collapsible="icon"
          className={cn(
            "fixed left-0 top-16 z-40 h-full border-r-2 border-slate-300 bg-card shadow-none dark:border-slate-600",
            "transition-[width] duration-300 ease-out motion-reduce:transition-none",
          )}
          style={{
            fontFamily: "system-ui, -apple-system, sans-serif",
            height: "calc(100vh - 4rem)",
          }}
        >
          <SidebarContent className="flex w-full min-w-0 flex-col gap-0 overflow-hidden p-0">
            <SidebarBrandHeader />
            <div className="min-h-0 w-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto seamless-scroll pb-4 pt-1">
              <div className="w-full min-w-0 space-y-0.5 px-0">
                {visibleNavItems.map((item) => {
                  const localizedTitle = t(item.titleKey);
                  const hasSub = Boolean(item.subItems && item.subItems.length > 0);
                  const parentActive = isParentActive(item);
                  const moduleLocked = isNavModuleLocked(item.id);

                  return (
                    <div key={item.id} className="w-full min-w-0">
                      <div
                        onMouseEnter={() => handleMenuItemHover(item.id, hasSub)}
                        className="group/item relative w-full min-w-0"
                      >
                        {item.path && item.path !== "#" ? (
                          <button
                            type="button"
                            onMouseEnter={() => prefetchAppRoute(item.path!)}
                            onFocus={() => prefetchAppRoute(item.path!)}
                            onClick={() => navigate(item.path!)}
                            className={cn(
                              "group relative flex h-11 w-full min-w-0 transform-none items-center justify-between rounded-none border-l-4 border-transparent px-2 text-left text-sm font-medium leading-none",
                              "text-foreground transition-[background-color,color] duration-200 ease-in-out motion-reduce:transition-none",
                              "hover:bg-brand-blue/10 hover:text-brand-blue",
                              "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
                              parentActive && "border-l-brand-blue bg-brand-blue/10 text-brand-blue",
                            )}
                          >
                            <div className="flex min-w-0 items-center">
                              <item.icon
                                className={cn(
                                  "mr-3 h-4 w-4 shrink-0 transform-none transition-colors duration-200 ease-in-out motion-reduce:transition-none",
                                  "group-data-[collapsible=icon]:mx-auto",
                                )}
                              />
                              <span
                                className={cn(
                                  "w-auto whitespace-nowrap text-sm font-medium leading-none opacity-100",
                                  "transition-[max-width,opacity,margin] duration-300 ease-out motion-reduce:transition-none",
                                  "group-data-[collapsible=icon]:ml-0 group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:overflow-hidden group-data-[collapsible=icon]:opacity-0",
                                )}
                              >
                                {localizedTitle}
                              </span>
                            </div>
                            {(hasSub || moduleLocked) && (
                              <div className="ml-auto flex shrink-0 items-center gap-1 group-data-[collapsible=icon]:hidden">
                                {moduleLocked ? (
                                  <Lock className="h-3 w-3 text-amber-700" aria-hidden />
                                ) : null}
                                {hasSub ? (
                                  <ChevronRight
                                    className={cn(
                                      "h-3 w-3 shrink-0 transform-none text-muted-foreground opacity-60 transition-[color,opacity] duration-200 ease-in-out motion-reduce:transition-none",
                                      parentActive && "text-brand-blue opacity-100",
                                      "group-hover:text-brand-blue group-hover:opacity-100",
                                    )}
                                  />
                                ) : null}
                              </div>
                            )}
                          </button>
                        ) : (
                          <div
                            className={cn(
                              "group relative flex h-11 w-full min-w-0 transform-none cursor-default items-center justify-between rounded-none border-l-4 border-transparent px-2 text-sm font-medium leading-none",
                              "text-foreground transition-[background-color,color] duration-200 ease-in-out motion-reduce:transition-none",
                              "hover:bg-brand-blue/10 hover:text-brand-blue",
                              "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
                              (activeSubSidebar === item.id || parentActive) &&
                                "border-l-brand-blue bg-brand-blue/10 text-brand-blue",
                            )}
                          >
                            <div className="flex min-w-0 items-center">
                              <item.icon
                                className={cn(
                                  "mr-3 h-4 w-4 shrink-0 transform-none transition-colors duration-200 ease-in-out motion-reduce:transition-none",
                                  "group-data-[collapsible=icon]:mx-auto",
                                )}
                              />
                              <span
                                className={cn(
                                  "w-auto whitespace-nowrap text-sm font-medium leading-none opacity-100",
                                  "transition-[max-width,opacity,margin] duration-300 ease-out motion-reduce:transition-none",
                                  "group-data-[collapsible=icon]:ml-0 group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:overflow-hidden group-data-[collapsible=icon]:opacity-0",
                                )}
                              >
                                {localizedTitle}
                              </span>
                            </div>
                            {(hasSub || moduleLocked) && (
                              <div className="ml-auto flex shrink-0 items-center gap-1 group-data-[collapsible=icon]:hidden">
                                {moduleLocked ? (
                                  <Lock className="h-3 w-3 text-amber-700" aria-hidden />
                                ) : null}
                                {hasSub ? (
                                  <ChevronRight
                                    className={cn(
                                      "h-3 w-3 shrink-0 transform-none text-muted-foreground opacity-60 transition-[color,opacity] duration-200 ease-in-out motion-reduce:transition-none",
                                      parentActive && "text-brand-blue opacity-100",
                                      "group-hover:text-brand-blue group-hover:opacity-100",
                                    )}
                                  />
                                ) : null}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </SidebarContent>
        </Sidebar>

        <div
          ref={subSidebarPanelRef}
          role="complementary"
          aria-hidden={!subSidebarOpen}
          onMouseEnter={handleSubSidebarMouseEnter}
          onMouseLeave={handleSubSidebarMouseLeave}
          onTransitionEnd={handleSubSidebarPanelTransitionEnd}
          className={cn(
            "pointer-events-none absolute left-full top-0 z-50 overflow-hidden",
            "h-full w-0 transform-gpu",
            "transition-[width] duration-300 ease-out motion-reduce:transition-none",
            subSidebarMeasuredOpen ? "pointer-events-auto w-64" : "w-0",
          )}
        >
          {panelContentMenu?.subItems && (
            <SubSidebarPanel
              key={panelContentMenu.id}
              items={panelContentMenu.subItems}
              titleKey={panelContentMenu.titleKey}
            />
          )}
        </div>
      </div>
    </div>
  );
}
