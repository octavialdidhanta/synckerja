import { useEffect, useRef, useState, useTransition, type TransitionEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { Sidebar, SidebarContent } from "@/shared/components/ui/sidebar";
import { cn } from "@/shared/lib/utils";
import {
  mainNavItems,
  pathBaseFromNavPath,
  isNavSubItemActive,
  type MainNavItem,
  type NavSubItem,
} from "./navConfig";
import { useSidebarState } from "./useSidebarState";
import { LiveChatAppBadgeSync } from "@/5-3-whatsapp/components/LiveChatAppBadgeSync";

interface SubSidebarPanelProps {
  items: NavSubItem[];
  isOpen: boolean;
  titleKey: string;
}

function SubSidebarPanel({ items, isOpen, titleKey }: SubSidebarPanelProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [, startTransition] = useTransition();
  const resolvedTitle = t(titleKey);

  return (
    <div
      className="h-full w-64 overflow-hidden bg-card font-sans antialiased transition-opacity duration-300 ease-in-out motion-reduce:transition-none"
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        opacity: isOpen ? 1 : 0,
      }}
    >
      <div className="box-border flex h-full w-64 flex-col border-r-2 border-slate-300 bg-card shadow-sm dark:border-slate-600">
        <div className="border-b border-slate-300 bg-muted/40 px-4 py-3 dark:border-slate-600">
          <h3 className="truncate text-sm font-semibold text-foreground">{resolvedTitle}</h3>
        </div>
        <div className="flex-1 overflow-y-auto seamless-scroll pt-2">
          <nav className="space-y-0">
            {items.map((item, index) => {
              const isActive = isNavSubItemActive(item, location.pathname, location.search);

              return (
                <button
                  key={`${item.titleKey}-${item.path}`}
                  type="button"
                  onClick={() =>
                    startTransition(() => {
                      navigate(item.path);
                    })
                  }
                  className={cn(
                    "group relative flex w-full transform-none items-center gap-3 px-4 py-3 text-left text-[15px] font-normal transition-colors duration-200",
                    isActive
                      ? "bg-brand-blue/10 text-brand-blue"
                      : "text-foreground hover:bg-brand-blue/10 hover:text-brand-blue",
                  )}
                  style={{
                    opacity: isOpen ? 1 : 0,
                    transition: `opacity 0.25s ease-in-out ${index * 25}ms`,
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
  const [, startTransition] = useTransition();
  const currentPath = location.pathname;
  const {
    activeSubSidebar,
    handleMouseEnter,
    handleMouseLeave,
    handleMenuItemHover,
    handleSubSidebarMouseEnter,
    handleSubSidebarMouseLeave,
  } = useSidebarState();

  const sidebarGroupRef = useRef<HTMLDivElement | null>(null);
  const subSidebarPanelRef = useRef<HTMLDivElement | null>(null);
  const [subSidebarLeft, setSubSidebarLeft] = useState(0);

  const activeMenuItem = mainNavItems.find(
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
      let raf1 = 0;
      let raf2 = 0;
      let cancelled = false;
      raf1 = requestAnimationFrame(() => {
        if (cancelled) return;
        raf2 = requestAnimationFrame(() => {
          if (!cancelled) setSubSidebarPaintOpen(true);
        });
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
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

  const handleSubSidebarPanelTransitionEnd = (e: TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.propertyName !== "width") return;
    if (!subSidebarOpen && !subSidebarPaintOpen) {
      setSubMenuSnapshot(null);
    }
  };

  const isSubContentVisible = subSidebarMeasuredOpen || Boolean(panelContentMenu && !subSidebarOpen);

  useEffect(() => {
    const updateSubSidebarAnchor = () => {
      if (!sidebarGroupRef.current) return;
      const rect = sidebarGroupRef.current.getBoundingClientRect();
      setSubSidebarLeft(rect.right);
    };

    updateSubSidebarAnchor();

    const resizeObserver = new ResizeObserver(() => {
      updateSubSidebarAnchor();
    });

    if (sidebarGroupRef.current) {
      resizeObserver.observe(sidebarGroupRef.current);
    }

    window.addEventListener("resize", updateSubSidebarAnchor);
    window.addEventListener("scroll", updateSubSidebarAnchor, true);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateSubSidebarAnchor);
      window.removeEventListener("scroll", updateSubSidebarAnchor, true);
    };
  }, []);

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
        ref={sidebarGroupRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="group relative z-40"
      >
        <Sidebar
          collapsible="icon"
          className={cn(
            "fixed left-0 top-16 z-40 h-full border-r-2 border-slate-300 bg-card shadow-none dark:border-slate-600",
            "transition-[width] duration-300 ease-in-out motion-reduce:transition-none",
          )}
          style={{
            fontFamily: "system-ui, -apple-system, sans-serif",
            height: "calc(100vh - 4rem)",
          }}
        >
          <SidebarContent className="flex w-full min-w-0 flex-col gap-0 overflow-hidden p-0">
            <div className="flex min-h-[3.25rem] shrink-0 items-center border-b border-slate-300 px-2 py-2 dark:border-slate-600">
              <Link
                to="/"
                className={cn(
                  "flex h-full min-h-0 w-full transform-none items-center justify-start rounded-lg px-1 py-0 outline-none ring-offset-background",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "group-data-[collapsible=icon]:justify-center",
                )}
              >
                <img
                  src="/favicon.png"
                  alt={t("layout.appName")}
                  className="h-8 w-auto max-w-full shrink-0 transform-none object-contain object-left group-data-[collapsible=icon]:object-center"
                  decoding="async"
                />
              </Link>
            </div>
            <div className="min-h-0 w-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto seamless-scroll pb-4 pt-1">
              <div className="w-full min-w-0 space-y-0.5 px-0">
                {mainNavItems.map((item) => {
                  const localizedTitle = t(item.titleKey);
                  const hasSub = Boolean(item.subItems && item.subItems.length > 0);
                  const parentActive = isParentActive(item);

                  return (
                    <div key={item.id} className="w-full min-w-0">
                      <div
                        onMouseEnter={() => handleMenuItemHover(item.id, hasSub)}
                        className="group/item relative w-full min-w-0"
                      >
                        {item.path && item.path !== "#" ? (
                          <button
                            type="button"
                            onClick={() =>
                              startTransition(() => {
                                navigate(item.path!);
                              })
                            }
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
                                  "group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:overflow-hidden group-data-[collapsible=icon]:opacity-0",
                                )}
                              >
                                {localizedTitle}
                              </span>
                            </div>
                            {hasSub && (
                              <ChevronRight
                                className={cn(
                                  "ml-auto h-3 w-3 shrink-0 transform-none text-muted-foreground opacity-60 transition-[color,opacity] duration-200 ease-in-out motion-reduce:transition-none",
                                  parentActive && "text-brand-blue opacity-100",
                                  "group-hover:text-brand-blue group-hover:opacity-100",
                                  "group-data-[collapsible=icon]:hidden",
                                )}
                              />
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
                                  "group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:overflow-hidden group-data-[collapsible=icon]:opacity-0",
                                )}
                              >
                                {localizedTitle}
                              </span>
                            </div>
                            {hasSub && (
                              <ChevronRight
                                className={cn(
                                  "ml-auto h-3 w-3 shrink-0 transform-none text-muted-foreground opacity-60 transition-[color,opacity] duration-200 ease-in-out motion-reduce:transition-none",
                                  parentActive && "text-brand-blue opacity-100",
                                  "group-hover:text-brand-blue group-hover:opacity-100",
                                  "group-data-[collapsible=icon]:hidden",
                                )}
                              />
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
            "pointer-events-none fixed top-16 z-50 overflow-hidden",
            "h-[calc(100vh-4rem)]",
            "transform-none transition-[width,opacity] duration-300 ease-in-out motion-reduce:transition-none",
            subSidebarMeasuredOpen ? "pointer-events-auto w-64 opacity-100" : "w-0 opacity-0",
          )}
          style={{ left: `${subSidebarLeft}px` }}
        >
          {panelContentMenu?.subItems && (
            <SubSidebarPanel
              key={panelContentMenu.id}
              items={panelContentMenu.subItems}
              isOpen={isSubContentVisible}
              titleKey={panelContentMenu.titleKey}
            />
          )}
        </div>
      </div>
    </div>
  );
}
