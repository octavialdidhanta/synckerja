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
import { useLeadMagnetEntitlement } from "@/6-1-lead-magnet/hooks/useLeadMagnetEntitlement";
import { prefetchAppRoute } from "@/shared/routing/prefetchAppRoute";
import {
  filterPosBackofficeNavItems,
  usePosStaffPermissions,
} from "@/8-2-8-employees-staff/hooks/usePosStaffPermissions";

interface SubSidebarPanelProps {
  items: NavSubItem[];
  titleKey: string;
  isSubItemLocked?: (item: NavSubItem) => boolean;
}

/** Logo + label: icon column matches collapsed rail so logo stays centered while width animates. */
function SidebarBrandHeader() {
  const { t } = useTranslation();
  const { state, isMobile } = useSidebar();
  const showBrandText = isMobile || state === "expanded";

  return (
    <div className="flex min-h-[3.25rem] shrink-0 items-center border-b border-slate-300 dark:border-slate-600">
      <Link
        to="/"
        className={cn(
          "flex h-full min-h-0 w-full min-w-0 items-center overflow-hidden outline-none ring-offset-background",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
      >
        <span className="flex h-full w-[--sidebar-width-icon] shrink-0 items-center justify-center">
          <img
            src={SYNCKERJA_BRAND_LOGO_SRC}
            alt={t("layout.appName")}
            width={192}
            height={192}
            loading="eager"
            decoding="sync"
            draggable={false}
            className="h-8 w-8 object-contain select-none"
            sizes="32px"
          />
        </span>
        <span
          aria-hidden
          className={cn(
            "min-w-0 flex-1 truncate pr-2 text-sm font-semibold leading-none tracking-tight text-foreground",
            "transition-opacity duration-150 ease-out motion-reduce:transition-none",
            showBrandText ? "opacity-100" : "opacity-0",
          )}
        >
          {t("layout.appName")}
        </span>
      </Link>
    </div>
  );
}

function SubSidebarPanel({ items, titleKey, isSubItemLocked }: SubSidebarPanelProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const resolvedTitle = t(titleKey);

  const sections: Array<{ title: string; items: NavSubItem[] }> = [];
  for (const item of items) {
    if (sections.length === 0 || item.sectionTitleKey) {
      sections.push({
        title: t(item.sectionTitleKey ?? titleKey),
        items: [item],
      });
    } else {
      sections[sections.length - 1].items.push(item);
    }
  }
  if (sections[0]) sections[0].title = resolvedTitle;

  const renderItem = (item: NavSubItem) => {
    const isActive = isNavSubItemActive(item, location.pathname, location.search);
    const locked = isSubItemLocked?.(item) ?? false;

    return (
      <button
        key={`${item.titleKey}-${item.path}`}
        type="button"
        title={
          locked
            ? t("leadMagnet.sidebar.lockedHint", "Lead Magnet add-on is not activated")
            : undefined
        }
        onMouseEnter={() => prefetchAppRoute(item.path)}
        onFocus={() => prefetchAppRoute(item.path)}
        onClick={() => navigate(item.path)}
        className={cn(
          "group relative flex w-full transform-none items-center gap-3 px-4 py-3 text-left text-[15px] font-normal transition-colors duration-200",
          locked && "opacity-70",
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
        {locked ? <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden /> : null}
        {isActive && (
          <div className="absolute bottom-0 left-0 top-0 w-1 bg-brand-blue" aria-hidden />
        )}
      </button>
    );
  };

  const sectionHeaderClassName =
    "box-border flex min-h-[3.25rem] shrink-0 items-center border-b border-slate-300 bg-muted/40 px-4 py-2 dark:border-slate-600";

  return (
    <div
      className="h-full w-64 overflow-hidden bg-card font-sans antialiased"
      style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
    >
      <div className="box-border flex h-full w-64 flex-col border-r border-slate-200 bg-card dark:border-slate-700/60">
        <div className="flex-1 overflow-y-auto seamless-scroll">
          {sections.map((section) => (
            <section key={section.title} className="flex flex-col">
              <div className={sectionHeaderClassName}>
                <h3 className="truncate text-sm font-semibold leading-none text-foreground">
                  {section.title}
                </h3>
              </div>
              <nav className="space-y-0 pt-2">{section.items.map(renderItem)}</nav>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { state: sidebarState } = useSidebar();
  const railExpanded = sidebarState === "expanded";
  const currentPath = location.pathname;
  const selfServiceEnabled = useSubscriptionSelfServiceEnabled();
  const { isModuleGatingActive, isModuleEnabled } = useEffectiveModuleAccess();
  const { hasEntitlement: hasLeadMagnetEntitlement, isPending: leadMagnetPending } =
    useLeadMagnetEntitlement();
  const posStaffPermissions = usePosStaffPermissions();

  const isSubItemLocked = (item: NavSubItem) => {
    if (!item.requiresLeadMagnetAddon) return false;
    if (leadMagnetPending) return false;
    if (!isModuleGatingActive) return false;
    if (!isModuleEnabled("digitalMarketing")) return false;
    return !hasLeadMagnetEntitlement;
  };

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

  const activeMenuItemRaw = visibleNavItems.find(
    (item) => item.id === activeSubSidebar && item.subItems && item.subItems.length > 0,
  );
  const posPermissionKeySig = [...posStaffPermissions.permissionKeys].sort().join("|");
  const activeMenuItem = useMemo(() => {
    if (!activeMenuItemRaw) return undefined;
    if (activeMenuItemRaw.id !== "operations" || !activeMenuItemRaw.subItems) {
      return activeMenuItemRaw;
    }
    return {
      ...activeMenuItemRaw,
      subItems: filterPosBackofficeNavItems(activeMenuItemRaw.subItems, {
        unrestricted: posStaffPermissions.unrestricted,
        permissionKeys: posStaffPermissions.permissionKeys,
      }),
    };
  }, [
    activeMenuItemRaw,
    posStaffPermissions.unrestricted,
    posStaffPermissions.permissionKeys,
    posPermissionKeySig,
  ]);
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
    if (e.propertyName !== "transform") return;
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
          className="fixed left-0 top-16 z-40 h-full border-r-2 border-slate-300 bg-card shadow-none dark:border-slate-600"
          style={{
            fontFamily: "system-ui, -apple-system, sans-serif",
            height: "calc(100vh - 4rem)",
          }}
        >
          <SidebarContent className="flex w-[--sidebar-width] min-w-[--sidebar-width] flex-col gap-0 overflow-hidden p-0">
            <SidebarBrandHeader />
            <div className="min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto seamless-scroll pb-4 pt-1">
              <div className="w-full space-y-0.5 px-0">
                {visibleNavItems.map((item) => {
                  const localizedTitle = t(item.titleKey);
                  const hasSub = Boolean(item.subItems && item.subItems.length > 0);
                  const parentActive = isParentActive(item);
                  const moduleLocked = isNavModuleLocked(item.id);

                  return (
                    <div key={item.id} className="w-full">
                      <div
                        onMouseEnter={() => handleMenuItemHover(item.id, hasSub)}
                        className="group/item relative w-full"
                      >
                        {item.path && item.path !== "#" ? (
                          <button
                            type="button"
                            onMouseEnter={() => prefetchAppRoute(item.path!)}
                            onFocus={() => prefetchAppRoute(item.path!)}
                            onClick={() => navigate(item.path!)}
                            className={cn(
                              "group relative flex h-11 w-full items-center rounded-none text-left text-sm font-medium leading-none",
                              "text-foreground transition-[background-color,color] duration-150 ease-out motion-reduce:transition-none",
                              "hover:bg-brand-blue/10 hover:text-brand-blue",
                              parentActive && "bg-brand-blue/10 text-brand-blue",
                            )}
                          >
                            {/* Fixed icon rail = collapsed width → icon stays centered while sidebar expands/collapses */}
                            <span className="flex h-full w-[--sidebar-width-icon] shrink-0 items-center justify-center">
                              <item.icon className="h-4 w-4 shrink-0 transition-colors duration-150 ease-out motion-reduce:transition-none" />
                            </span>
                            <span
                              className={cn(
                                "flex min-w-0 flex-1 items-center justify-between pr-2",
                                "transition-opacity duration-150 ease-out motion-reduce:transition-none",
                                "group-data-[collapsible=icon]:opacity-0",
                              )}
                            >
                              <span className="truncate whitespace-nowrap text-sm font-medium leading-none">
                                {localizedTitle}
                              </span>
                              {(hasSub || moduleLocked) && (
                                <span className="ml-auto flex shrink-0 items-center gap-1">
                                  {moduleLocked ? (
                                    <Lock className="h-3 w-3 text-amber-700" aria-hidden />
                                  ) : null}
                                  {hasSub ? (
                                    <ChevronRight
                                      className={cn(
                                        "h-3 w-3 shrink-0 text-muted-foreground opacity-60 transition-[color,opacity] duration-150 ease-out motion-reduce:transition-none",
                                        parentActive && "text-brand-blue opacity-100",
                                        "group-hover:text-brand-blue group-hover:opacity-100",
                                      )}
                                    />
                                  ) : null}
                                </span>
                              )}
                            </span>
                            {parentActive ? (
                              <span className="absolute bottom-0 left-0 top-0 w-1 bg-brand-blue" aria-hidden />
                            ) : null}
                          </button>
                        ) : (
                          <div
                            className={cn(
                              "group relative flex h-11 w-full cursor-default items-center rounded-none text-sm font-medium leading-none",
                              "text-foreground transition-[background-color,color] duration-150 ease-out motion-reduce:transition-none",
                              "hover:bg-brand-blue/10 hover:text-brand-blue",
                              (activeSubSidebar === item.id || parentActive) &&
                                "bg-brand-blue/10 text-brand-blue",
                            )}
                          >
                            <span className="flex h-full w-[--sidebar-width-icon] shrink-0 items-center justify-center">
                              <item.icon className="h-4 w-4 shrink-0 transition-colors duration-150 ease-out motion-reduce:transition-none" />
                            </span>
                            <span
                              className={cn(
                                "flex min-w-0 flex-1 items-center justify-between pr-2",
                                "transition-opacity duration-150 ease-out motion-reduce:transition-none",
                                "group-data-[collapsible=icon]:opacity-0",
                              )}
                            >
                              <span className="truncate whitespace-nowrap text-sm font-medium leading-none">
                                {localizedTitle}
                              </span>
                              {(hasSub || moduleLocked) && (
                                <span className="ml-auto flex shrink-0 items-center gap-1">
                                  {moduleLocked ? (
                                    <Lock className="h-3 w-3 text-amber-700" aria-hidden />
                                  ) : null}
                                  {hasSub ? (
                                    <ChevronRight
                                      className={cn(
                                        "h-3 w-3 shrink-0 text-muted-foreground opacity-60 transition-[color,opacity] duration-150 ease-out motion-reduce:transition-none",
                                        parentActive && "text-brand-blue opacity-100",
                                        "group-hover:text-brand-blue group-hover:opacity-100",
                                      )}
                                    />
                                  ) : null}
                                </span>
                              )}
                            </span>
                            {activeSubSidebar === item.id || parentActive ? (
                              <span className="absolute bottom-0 left-0 top-0 w-1 bg-brand-blue" aria-hidden />
                            ) : null}
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
          className={cn(
            // Parent is pinned to the collapsed rail, so track the expanded rail edge with a
            // GPU transform that matches the rail's own width timing.
            "absolute left-full top-0 z-50 h-full w-64 overflow-hidden transform-gpu",
            "transition-transform duration-300 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
            railExpanded
              ? "translate-x-[calc(var(--sidebar-width)-var(--sidebar-width-icon))]"
              : "translate-x-0",
            subSidebarMeasuredOpen ? "pointer-events-auto" : "pointer-events-none",
          )}
        >
          <div
            onTransitionEnd={handleSubSidebarPanelTransitionEnd}
            className={cn(
              "h-full w-64 transform-gpu [backface-visibility:hidden]",
              "transition-transform duration-300 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
              subSidebarMeasuredOpen ? "translate-x-0" : "-translate-x-full",
            )}
          >
            {panelContentMenu?.subItems && (
              <SubSidebarPanel
                key={panelContentMenu.id}
                items={panelContentMenu.subItems}
                titleKey={panelContentMenu.panelTitleKey ?? panelContentMenu.titleKey}
                isSubItemLocked={isSubItemLocked}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
