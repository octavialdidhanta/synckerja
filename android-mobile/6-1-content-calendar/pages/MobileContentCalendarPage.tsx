import React, { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from "date-fns";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppSidebar } from "@/mobile-app/components/AppSidebar";
import { SidebarProvider } from "@/mobile-app/components/ui/sidebar";
import { useVisualViewport } from "@/shared/hooks/useVisualViewport";
import { useStatusBarStyle } from "@/shared/hooks/useStatusBarStyle";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import { MOBILE_PAGE_PATH } from "@/shared/auth/page-access/mobileRoutePagePaths";
import { ToolsMobileDenyGateArea } from "@/mobile-app/components/ToolsMobileDenyGateArea";
import { useMobileToolsShellLayout } from "@/shared/hooks/useMobileToolsShellLayout";
import { useToolsMobilePageAccess } from "@/mobile-app/hooks/useToolsMobilePageAccess";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { useModulePageOverlaySkeleton } from "@/shared/auth/page-access/useModulePageOverlaySkeleton";
import {
  useSocialMediaData,
  useSocialMediaMutations,
} from "@/6-1-dashboard/hook/useOptimizedSocialMediaState";
import { ContentPlan } from "@/6-1-dashboard/types/social-media";
import { RealtimeSocialMediaProvider } from "@/6-1-dashboard/hook/RealtimeSocialMediaProvider";
import OptimizedErrorBoundary from "@/6-1-dashboard/components/OptimizedErrorBoundary";
import { PICFilterProvider } from "@/6-1-dashboard/context/PICFilterContext";
import { usePublicReviewToken } from "@/6-1-dashboard/hook/usePublicReviewToken";
import { prefetchBriefStoryboardImages } from "@/6-1-dashboard/hook/useBriefStoryboardImages";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { AddContentDialog } from "@/6-1-content-calendar/modal/AddContentDialog";
import { ContentCalendarMobileShellHeader } from "@/mobile/6-1-content-calendar/components/ContentCalendarMobileShellHeader";
import { MobileContentCalendarFilterStrip } from "@/mobile/6-1-content-calendar/components/MobileContentCalendarFilterStrip";
import { MobileDayPlanPickerSheet } from "@/mobile/6-1-content-calendar/components/MobileDayPlanPickerSheet";
import { MobilePlanBriefSheet } from "@/mobile/6-1-content-calendar/components/MobilePlanBriefSheet";
import { SocialMediaMobileFooter } from "@/mobile/6-1-content-calendar/components/SocialMediaMobileFooter";
import { MobileContentCalendarTab } from "@/mobile/6-1-content-calendar/sections/MobileContentCalendarTab";
import { MobileFunnelSection } from "@/mobile/6-1-content-calendar/sections/MobileFunnelSection";
import { MobileContentBalanceSection } from "@/mobile/6-1-content-calendar/sections/MobileContentBalanceSection";
import { MobilePersonaSection } from "@/mobile/6-1-content-calendar/sections/persona/MobilePersonaSection";
import { MobileContentCalendarViewSkeleton } from "@/mobile/6-1-content-calendar/sections/MobileContentCalendarViewSkeleton";
import {
  pagePathForContentCalendarTab,
  parseContentCalendarTab,
} from "@/mobile/6-1-content-calendar/shared/contentCalendarNavPaths";
import { refreshContentPillarTrackerQueries } from "@/6-1-dashboard/lib/contentPillarTracker";

const PULL_THRESHOLD = 52;
const MAX_PULL = 72;
const INDICATOR_HEIGHT = 56;
const PULL_RESISTANCE = 0.55;

function MobileContentCalendarPageContent() {
  useStatusBarStyle("light");
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const activeTab = parseContentCalendarTab(searchParams.toString());
  const pagePath = pagePathForContentCalendarTab(activeTab);
  const { mainFixedStyle, isKeyboardShellOpen } = useVisualViewport();
  const { getOrCreate } = usePublicReviewToken();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [briefPlanId, setBriefPlanId] = useState<string | null>(null);
  const [showAddContentDialog, setShowAddContentDialog] = useState(false);
  const [selectedService, setSelectedService] = useState<string>("all");
  const [previewLoading, setPreviewLoading] = useState(false);

  const { loading: orgBootstrapPending, organizationId: activeOrgId } = useCurrentOrg();
  const { contentPlans, services, isLoading: socialDataLoading } = useSocialMediaData();
  const { refreshAll, deleteContentPlan } = useSocialMediaMutations();
  const [planToDelete, setPlanToDelete] = useState<ContentPlan | null>(null);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const pullDistanceRef = useRef(0);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const pullIndicatorRef = useRef<HTMLDivElement>(null);
  const pullIconRef = useRef<SVGSVGElement>(null);
  const pullReleaseRef = useRef<HTMLSpanElement>(null);

  const applyPullVisual = useCallback((distance: number, animate: boolean) => {
    const indicator = pullIndicatorRef.current;
    if (!indicator) return;
    indicator.style.transition = animate
      ? "height 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)"
      : "none";
    indicator.style.height = `${distance}px`;
    const icon = pullIconRef.current;
    if (icon) {
      icon.style.transition = animate ? "transform 0.2s ease-out" : "none";
      icon.style.transform = `rotate(${Math.min((distance / PULL_THRESHOLD) * 180, 180)}deg)`;
      icon.style.display = distance >= PULL_THRESHOLD ? "none" : "";
    }
    const release = pullReleaseRef.current;
    if (release) {
      release.style.display = distance >= PULL_THRESHOLD ? "" : "none";
    }
  }, []);

  const handlePullRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    applyPullVisual(INDICATOR_HEIGHT, true);
    try {
      if (activeTab === "funnel") {
        await refreshContentPillarTrackerQueries(queryClient, activeOrgId);
        toast.success("Data refreshed");
      } else {
        await refreshAll();
      }
    } catch {
      toast.error(
        activeTab === "funnel"
          ? t("contentCalendar.mobile.refreshFailed", "Gagal memperbarui data.")
          : t("contentCalendar.mobile.refreshFailed", "Gagal memperbarui kalender."),
      );
    } finally {
      setIsRefreshing(false);
      applyPullVisual(0, true);
    }
  }, [activeTab, activeOrgId, applyPullVisual, isRefreshing, queryClient, refreshAll, t]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
    pullDistanceRef.current = 0;
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const el = listScrollRef.current;
      if (!el || isRefreshing) return;

      const target = e.target as HTMLElement | null;
      if (target?.closest?.("[data-horizontal-scroll-zone]")) return;
      if (el.scrollTop > 2) return;

      const dx = e.touches[0].clientX - touchStartX.current;
      const delta = e.touches[0].clientY - touchStartY.current;
      if (Math.abs(dx) > Math.abs(delta) || delta <= 0) {
        if (pullDistanceRef.current !== 0) {
          pullDistanceRef.current = 0;
          applyPullVisual(0, false);
        }
        return;
      }

      const d = Math.min(delta * PULL_RESISTANCE, MAX_PULL);
      pullDistanceRef.current = d;
      applyPullVisual(d, false);
    },
    [applyPullVisual, isRefreshing],
  );

  const onTouchEnd = useCallback(() => {
    const d = pullDistanceRef.current;
    pullDistanceRef.current = 0;
    if (d >= PULL_THRESHOLD) {
      void handlePullRefresh();
      return;
    }
    applyPullVisual(0, true);
  }, [applyPullVisual, handlePullRefresh]);

  const dataPending = Boolean(activeOrgId) && socialDataLoading;
  const rawPendingLoad = orgBootstrapPending || dataPending;
  const { showFullPageSkeleton, hasPageAccess } = useModulePageOverlaySkeleton(
    rawPendingLoad,
    pagePath,
  );
  const showContent = useDebouncedReady(!showFullPageSkeleton, 220);

  const filteredContentPlans = useMemo(() => {
    if (selectedService === "all") return contentPlans;
    return contentPlans.filter((plan) => plan.service_id === selectedService);
  }, [contentPlans, selectedService]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startDay = monthStart.getDay();
  const daysFromPrevMonth = startDay === 0 ? 0 : startDay;
  const totalCells = Math.ceil((daysInMonth.length + daysFromPrevMonth) / 7) * 7;

  const calendarDays = useMemo(() => {
    const days: Array<{ date: Date; isCurrentMonth: boolean }> = [];
    const prevMonth = subMonths(currentDate, 1);
    const prevMonthEnd = endOfMonth(prevMonth);
    for (let i = daysFromPrevMonth - 1; i >= 0; i--) {
      const day = new Date(prevMonthEnd);
      day.setDate(prevMonthEnd.getDate() - i);
      days.push({ date: day, isCurrentMonth: false });
    }
    daysInMonth.forEach((day) => {
      days.push({ date: day, isCurrentMonth: true });
    });
    const nextMonth = addMonths(currentDate, 1);
    const remainingCells = totalCells - days.length;
    for (let i = 1; i <= remainingCells; i++) {
      days.push({
        date: new Date(nextMonth.getFullYear(), nextMonth.getMonth(), i),
        isCurrentMonth: false,
      });
    }
    return days;
  }, [currentDate, daysFromPrevMonth, daysInMonth, totalCells]);

  const plansByDate = useMemo(() => {
    const plans: { [key: string]: ContentPlan[] } = {};
    filteredContentPlans.forEach((plan) => {
      if (plan.post_date) {
        const dateKey = format(new Date(plan.post_date), "yyyy-MM-dd");
        if (!plans[dateKey]) plans[dateKey] = [];
        plans[dateKey].push(plan);
      }
    });
    return plans;
  }, [filteredContentPlans]);

  const getDayInfo = useCallback(
    (date: Date) => {
      const dateKey = format(date, "yyyy-MM-dd");
      const plansForDay = plansByDate[dateKey] || [];
      if (plansForDay.length === 0) {
        return { color: "", count: 0, status: "empty", plans: [], lateText: null };
      }

      let hasRed = false;
      let hasOrange = false;
      let hasYellow = false;
      let hasGreen = false;
      let hasGreenWithLate = false;
      let lateText: string | null = null;

      plansForDay.forEach((plan) => {
        const approved = plan.approved === true;
        const productionApproved = plan.production_approved === true;
        const done = plan.done === true;
        const onTimeStatus = plan.on_time_status;
        const hasLateStatus =
          onTimeStatus &&
          onTimeStatus.trim() !== "" &&
          onTimeStatus !== "Ontime" &&
          onTimeStatus.toLowerCase().includes("late");

        if (!approved && !productionApproved && !done) {
          hasRed = true;
        } else if (approved && !productionApproved && !done) {
          hasOrange = true;
        } else if (approved && productionApproved && !done) {
          hasYellow = true;
        } else if (approved && productionApproved && done) {
          hasGreen = true;
          if (hasLateStatus) {
            hasGreenWithLate = true;
            lateText = onTimeStatus;
          }
        }
      });

      if (hasRed) {
        return { color: "", count: plansForDay.length, status: "red", plans: plansForDay, lateText: null };
      }
      if (hasOrange) {
        return {
          color: "",
          count: plansForDay.length,
          status: "orange",
          plans: plansForDay,
          lateText: null,
        };
      }
      if (hasYellow) {
        return {
          color: "",
          count: plansForDay.length,
          status: "yellow",
          plans: plansForDay,
          lateText: null,
        };
      }
      if (hasGreenWithLate) {
        return {
          color: "",
          count: plansForDay.length,
          status: "green-late",
          plans: plansForDay,
          lateText,
        };
      }
      if (hasGreen) {
        return {
          color: "",
          count: plansForDay.length,
          status: "green",
          plans: plansForDay,
          lateText: null,
        };
      }
      return {
        color: "",
        count: plansForDay.length,
        status: "planned",
        plans: plansForDay,
        lateText: null,
      };
    },
    [plansByDate],
  );

  const monthlyStats = useMemo(() => {
    const currentMonthPlans = filteredContentPlans.filter((plan) => {
      if (!plan.post_date) return false;
      const postDate = new Date(plan.post_date);
      return (
        postDate.getMonth() === currentDate.getMonth() &&
        postDate.getFullYear() === currentDate.getFullYear()
      );
    });

    let redCount = 0;
    let orangeCount = 0;
    let yellowCount = 0;
    let greenCount = 0;
    let greenWithLateCount = 0;

    currentMonthPlans.forEach((plan) => {
      const approved = plan.approved === true;
      const productionApproved = plan.production_approved === true;
      const done = plan.done === true;
      const onTimeStatus = plan.on_time_status;
      const hasLateStatus =
        onTimeStatus &&
        onTimeStatus.trim() !== "" &&
        onTimeStatus !== "Ontime" &&
        onTimeStatus.toLowerCase().includes("late");

      if (!approved && !productionApproved && !done) {
        redCount++;
      } else if (approved && !productionApproved && !done) {
        orangeCount++;
      } else if (approved && productionApproved && !done) {
        yellowCount++;
      } else if (approved && productionApproved && done) {
        if (hasLateStatus) greenWithLateCount++;
        else greenCount++;
      }
    });

    return {
      red: redCount,
      orange: orangeCount,
      yellow: yellowCount,
      green: greenCount,
      greenWithLate: greenWithLateCount,
      total: currentMonthPlans.length,
    };
  }, [filteredContentPlans, currentDate]);

  const openBriefForPlan = useCallback(
    (planId: string) => {
      void prefetchBriefStoryboardImages(queryClient, planId);
      setBriefPlanId(planId);
      setBriefOpen(true);
      setPickerOpen(false);
    },
    [queryClient],
  );

  const openPickerForDate = useCallback(
    (date: Date) => {
      setSelectedDate(date);
      const dayKey = format(date, "yyyy-MM-dd");
      const dayPlans = plansByDate[dayKey] || [];
      dayPlans.forEach((plan: { id?: string }) => {
        if (plan?.id) void prefetchBriefStoryboardImages(queryClient, plan.id);
      });
      setBriefPlanId(null);
      setBriefOpen(false);
      setPickerOpen(true);
    },
    [plansByDate, queryClient],
  );

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    const dayKey = format(date, "yyyy-MM-dd");
    const dayPlans = plansByDate[dayKey] || [];
    if (dayPlans.length === 1 && dayPlans[0]?.id) {
      openBriefForPlan(dayPlans[0].id);
      return;
    }
    openPickerForDate(date);
  };

  const handlePlanClick = (date: Date, plan: any) => {
    setSelectedDate(date);
    if (plan?.id) {
      openBriefForPlan(plan.id);
      return;
    }
    openPickerForDate(date);
  };

  const handleAddContent = async (date: Date) => {
    setSelectedDate(date);
    setEditingPlan(null);
    setPickerOpen(false);
    setBriefOpen(false);
    setBriefPlanId(null);
    setShowAddContentDialog(true);
  };

  const dayPlansForPicker = useMemo(() => {
    if (!selectedDate) return [];
    return plansByDate[format(selectedDate, "yyyy-MM-dd")] || [];
  }, [plansByDate, selectedDate]);

  const briefPlan = useMemo(() => {
    if (!briefPlanId) return null;
    const fromDay = dayPlansForPicker.find((p: any) => p?.id === briefPlanId);
    if (fromDay) return fromDay;
    return contentPlans.find((p) => p.id === briefPlanId) ?? null;
  }, [briefPlanId, dayPlansForPicker, contentPlans]);

  const pickerIsSource = dayPlansForPicker.length >= 1;

  const handleRequestDeletePlan = useCallback((plan: { id?: string; title?: string | null }) => {
    if (!plan?.id) return;
    const fullPlan =
      dayPlansForPicker.find((p) => p.id === plan.id) ??
      contentPlans.find((p) => p.id === plan.id);
    setPlanToDelete(fullPlan ?? ({ id: plan.id, title: plan.title ?? null } as ContentPlan));
  }, [contentPlans, dayPlansForPicker]);

  const handleConfirmDeletePlan = useCallback(async () => {
    if (!planToDelete?.id || deletingPlanId) return;
    setDeletingPlanId(planToDelete.id);
    try {
      await deleteContentPlan(planToDelete.id);
      toast.success(
        t("contentCalendar.mobile.deletePlanSuccess", "Content plan deleted."),
      );
      setPlanToDelete(null);
    } catch {
      toast.error(
        t("contentCalendar.mobile.deletePlanError", "Failed to delete content plan."),
      );
    } finally {
      setDeletingPlanId(null);
    }
  }, [deleteContentPlan, deletingPlanId, planToDelete, t]);

  const handleOpenPreview = useCallback(
    async (plan: any) => {
      if (!plan?.id || previewLoading) return;
      const linkUrl =
        typeof plan.google_drive_link === "string" ? plan.google_drive_link.trim() : "";
      if (!linkUrl) {
        toast.error(
          t("dailyTask.approval.noContentLink", "No content link for this plan."),
        );
        return;
      }
      setPreviewLoading(true);
      try {
        const { token } = await getOrCreate({
          socialMediaPlanId: plan.id,
          linkUrl,
        });
        navigate(`/review/${token}`, { state: { from: "content-calendar" } });
      } catch (e) {
        toast.error(
          e instanceof Error
            ? e.message
            : t("dailyTask.approval.reviewOpenFailed", "Failed to open review."),
        );
      } finally {
        setPreviewLoading(false);
      }
    },
    [getOrCreate, navigate, previewLoading, t],
  );

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/70">
        <AppSidebar />
        <main className="fixed inset-x-0 z-0 flex flex-col bg-muted/70" style={mainFixedStyle}>
          <ContentCalendarMobileShellHeader
            showServiceFilter
            services={Array.isArray(services) ? services : []}
            selectedService={selectedService}
            onServiceChange={setSelectedService}
          />

          <ModuleShellContentGate
            pagePath={pagePath}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            {hasPageAccess ? (
              <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                <div
                  ref={listScrollRef}
                  className={cn(
                    "scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-webkit-overflow-scrolling:touch] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                    !showContent && "pointer-events-none invisible select-none",
                  )}
                  aria-hidden={!showContent}
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                >
                  <div
                    ref={pullIndicatorRef}
                    className="flex h-0 shrink-0 items-center justify-center overflow-hidden text-sm text-muted-foreground"
                  >
                    {isRefreshing ? (
                      <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden />
                    ) : (
                      <>
                        <RefreshCw
                          ref={pullIconRef}
                          className="h-5 w-5 shrink-0 opacity-80"
                          aria-hidden
                        />
                        <span
                          ref={pullReleaseRef}
                          className="whitespace-nowrap text-xs font-medium text-primary"
                          style={{ display: "none" }}
                        >
                          {t("common.pullToRefresh.release", "Lepas untuk refresh")}
                        </span>
                      </>
                    )}
                  </div>
                  <div
                    className={cn(
                      "mx-auto w-full max-w-md space-y-1 px-2 pt-1",
                      activeTab === "persona"
                        ? "flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden content-padding-above-nav-default"
                        : "content-padding-above-nav-default",
                    )}
                  >
                    {activeTab !== "persona" ? (
                      <MobileContentCalendarFilterStrip
                        currentDate={currentDate}
                        onPrevMonth={() => setCurrentDate(subMonths(currentDate, 1))}
                        onNextMonth={() => setCurrentDate(addMonths(currentDate, 1))}
                      />
                    ) : null}

                    {activeTab === "funnel" ? (
                      <MobileFunnelSection
                        selectedMonth={currentDate}
                        serviceFilter={selectedService}
                      />
                    ) : activeTab === "balance" ? (
                      <MobileContentBalanceSection
                        selectedMonth={currentDate}
                        serviceFilter={selectedService}
                      />
                    ) : activeTab === "persona" ? (
                      <MobilePersonaSection />
                    ) : (
                      <MobileContentCalendarTab
                        monthlyStats={monthlyStats}
                        calendarDays={calendarDays}
                        getDayInfo={getDayInfo}
                        onDayClick={handleDayClick}
                        onPlanClick={handlePlanClick}
                        onPlanPrefetch={(plan) => {
                          if (plan?.id) void prefetchBriefStoryboardImages(queryClient, plan.id);
                        }}
                        onOpenPreview={handleOpenPreview}
                      />
                    )}
                  </div>
                </div>

                {!showContent ? (
                  <div
                    className="absolute inset-0 z-20 flex min-h-0 min-w-0 flex-col overflow-hidden bg-muted/70"
                    aria-busy
                  >
                    <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <MobileContentCalendarViewSkeleton tab={activeTab} />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </ModuleShellContentGate>

          {!isKeyboardShellOpen ? (
            <SocialMediaMobileFooter className="safe-area-bottom-lower" />
          ) : null}
        </main>
      </div>

      <MobileDayPlanPickerSheet
        open={pickerOpen}
        onOpenChange={(open) => {
          setPickerOpen(open);
          if (!open && !briefOpen) setSelectedDate(null);
        }}
        selectedDate={selectedDate}
        plans={dayPlansForPicker}
        onSelectPlan={(plan) => {
          if (!plan?.id) return;
          openBriefForPlan(plan.id);
        }}
        onDeletePlan={handleRequestDeletePlan}
        deletingPlanId={deletingPlanId}
        onAddContent={handleAddContent}
      />

      <MobilePlanBriefSheet
        open={briefOpen}
        onOpenChange={(open) => {
          setBriefOpen(open);
          if (!open) {
            setBriefPlanId(null);
            if (pickerIsSource) {
              setPickerOpen(true);
            } else {
              setSelectedDate(null);
            }
          }
        }}
        plan={
          briefPlan
            ? {
                id: briefPlan.id,
                title: briefPlan.title,
                brief: briefPlan.brief,
                content_pillar_id: briefPlan.content_pillar_id,
                content_pillar: briefPlan.content_pillar,
                service: briefPlan.service,
              }
            : null
        }
        showBackToPicker={pickerIsSource}
        onBackToPicker={() => {
          setBriefOpen(false);
          setBriefPlanId(null);
          setPickerOpen(true);
        }}
      />

      <Dialog
        open={planToDelete != null}
        onOpenChange={(open) => {
          if (!open && deletingPlanId == null) setPlanToDelete(null);
        }}
      >
        <DialogContent
          hideCloseButton
          fullscreenAnimation
          overlayClassName="z-[100]"
          className="fixed inset-0 left-0 right-0 top-0 z-[100] m-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col items-center justify-center gap-6 overflow-hidden rounded-none border-none bg-background p-6 shadow-none modal-above-safe-area"
        >
          <DialogHeader className="space-y-0 text-center sm:text-center">
            <DialogTitle className="flex flex-col items-center gap-3 text-lg font-semibold text-destructive">
              <Trash2 className="h-8 w-8 shrink-0" aria-hidden />
              {t("contentCalendar.mobile.deletePlanConfirmTitle", "Delete content plan?")}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t(
                "contentCalendar.mobile.deletePlanConfirmBody",
                'This will permanently delete "{{title}}". This action cannot be undone.',
                {
                  title:
                    planToDelete?.title?.trim() ||
                    t("contentCalendar.mobile.untitled", "Untitled"),
                },
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={deletingPlanId != null}
              onClick={() => {
                if (deletingPlanId == null) setPlanToDelete(null);
              }}
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deletingPlanId != null || planToDelete?.id == null}
              onClick={() => {
                void handleConfirmDeletePlan();
              }}
            >
              {deletingPlanId != null ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  {t("contentCalendar.mobile.deletingPlan", "Deleting...")}
                </>
              ) : (
                t("contentCalendar.mobile.deletePlan", "Delete")
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AddContentDialog
        open={showAddContentDialog}
        onOpenChange={(open) => {
          setShowAddContentDialog(open);
          if (!open) setEditingPlan(null);
        }}
        selectedDate={selectedDate}
        editingPlan={editingPlan}
        serviceFilter={selectedService}
      />
    </SidebarProvider>
  );
}

function MobileContentCalendarPageInner() {
  useStatusBarStyle("light");
  const { isKeyboardShellOpen } = useVisualViewport();
  const { outerShellClassName, mainShellClassName, mainShellStyle } = useMobileToolsShellLayout();
  const pagePath = MOBILE_PAGE_PATH.digitalMarketingSocialMedia;
  const { showDenyShellHeader } = useToolsMobilePageAccess(pagePath);

  if (showDenyShellHeader) {
    return (
      <SidebarProvider>
        <div className={cn(outerShellClassName, "bg-muted/70")}>
          <AppSidebar />
          <main
            className={cn(
              "z-0 flex w-full min-w-0 max-w-none flex-col bg-muted/70",
              mainShellClassName,
            )}
            style={mainShellStyle}
          >
            <ContentCalendarMobileShellHeader />
            <ToolsMobileDenyGateArea
              pagePath={pagePath}
              contentPaddingClass="content-padding-above-nav-default"
            />
            {!isKeyboardShellOpen ? (
              <SocialMediaMobileFooter className="safe-area-bottom-lower" />
            ) : null}
          </main>
        </div>
      </SidebarProvider>
    );
  }

  return <MobileContentCalendarPageContent />;
}

export default function MobileContentCalendarPage() {
  return (
    <OptimizedErrorBoundary>
      <RealtimeSocialMediaProvider>
        <PICFilterProvider>
          <MobileContentCalendarPageInner />
        </PICFilterProvider>
      </RealtimeSocialMediaProvider>
    </OptimizedErrorBoundary>
  );
}
