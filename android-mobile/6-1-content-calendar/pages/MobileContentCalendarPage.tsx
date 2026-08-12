import React, { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from "date-fns";
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
} from "@/6-1-dashboard/hook/useOptimizedSocialMediaState";
import { ContentPlan } from "@/6-1-dashboard/types/social-media";
import { RealtimeSocialMediaProvider } from "@/6-1-dashboard/hook/RealtimeSocialMediaProvider";
import OptimizedErrorBoundary from "@/6-1-dashboard/components/OptimizedErrorBoundary";
import { PICFilterProvider } from "@/6-1-dashboard/context/PICFilterContext";
import { usePublicReviewToken } from "@/6-1-dashboard/hook/usePublicReviewToken";
import { CalendarStats } from "@/6-1-content-calendar/container/CalendarStats";
import { CalendarGrid } from "@/6-1-content-calendar/container/CalendarGrid";
import { AddContentDialog } from "@/6-1-content-calendar/modal/AddContentDialog";
import { ContentCalendarMobileShellHeader } from "@/mobile/6-1-content-calendar/components/ContentCalendarMobileShellHeader";
import { MobileContentCalendarFilterStrip } from "@/mobile/6-1-content-calendar/components/MobileContentCalendarFilterStrip";
import { MobileDayPlanPickerSheet } from "@/mobile/6-1-content-calendar/components/MobileDayPlanPickerSheet";
import { MobilePlanBriefSheet } from "@/mobile/6-1-content-calendar/components/MobilePlanBriefSheet";
import { SocialMediaMobileFooter } from "@/mobile/6-1-content-calendar/components/SocialMediaMobileFooter";

function MobileContentCalendarPageContent({ hasPageAccess }: { hasPageAccess: boolean }) {
  useStatusBarStyle("light");
  const { t } = useAppTranslation();
  const navigate = useNavigate();
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

  const dataPending = Boolean(activeOrgId) && socialDataLoading;
  const rawPendingLoad = orgBootstrapPending || dataPending;
  const { showFullPageSkeleton } = useModulePageOverlaySkeleton(
    rawPendingLoad,
    MOBILE_PAGE_PATH.digitalMarketingContentCalendar,
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

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    const dayKey = format(date, "yyyy-MM-dd");
    const dayPlans = plansByDate[dayKey] || [];
    if (dayPlans.length === 1 && dayPlans[0]?.id) {
      setBriefPlanId(dayPlans[0].id);
      setBriefOpen(true);
      setPickerOpen(false);
      return;
    }
    setBriefPlanId(null);
    setBriefOpen(false);
    setPickerOpen(true);
  };

  const handlePlanClick = (date: Date, plan: any) => {
    setSelectedDate(date);
    if (plan?.id) {
      setBriefPlanId(plan.id);
      setBriefOpen(true);
      setPickerOpen(false);
      return;
    }
    setBriefPlanId(null);
    setBriefOpen(false);
    setPickerOpen(true);
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

  const multiPlanDay = dayPlansForPicker.length > 1;

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

  const pagePath = MOBILE_PAGE_PATH.digitalMarketingContentCalendar;

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
                  className={cn(
                    "scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                    !showContent && "pointer-events-none invisible select-none",
                  )}
                  aria-hidden={!showContent}
                >
                  <div className="mx-auto w-full max-w-md space-y-1 px-2 pt-1 content-padding-above-nav-default">
                    <MobileContentCalendarFilterStrip
                      currentDate={currentDate}
                      onPrevMonth={() => setCurrentDate(subMonths(currentDate, 1))}
                      onNextMonth={() => setCurrentDate(addMonths(currentDate, 1))}
                    />

                    <div className="-mx-2 border-y border-border bg-card px-2 py-2 [&>div]:grid-cols-2 [&>div]:gap-1.5 [&>div>div]:p-3 [&>div>div]:rounded-none [&>div>div]:border-0">
                      <CalendarStats monthlyStats={monthlyStats} />
                    </div>

                    <div className="-mx-2 border-y border-border bg-card px-0 py-2">
                      <CalendarGrid
                        calendarDays={calendarDays}
                        getDayInfo={getDayInfo}
                        onDayClick={handleDayClick}
                        onPlanClick={handlePlanClick}
                        onOpenPreview={handleOpenPreview}
                        layout="mobile-h-scroll"
                      />
                    </div>
                  </div>
                </div>

                {!showContent ? (
                  <div
                    className="absolute inset-0 z-20 flex min-h-0 min-w-0 flex-col overflow-hidden bg-muted/70"
                    aria-busy
                  >
                    <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <div className="mx-auto w-full max-w-md space-y-1 px-2 pt-1 content-padding-above-nav-default">
                        <div className="mx-auto h-7 w-36 animate-pulse rounded bg-muted/40" />
                        <div className="-mx-2 grid grid-cols-2 gap-px overflow-hidden border-y border-border bg-border">
                          {Array.from({ length: 6 }, (_, i) => (
                            <div key={i} className="bg-card px-3 py-3">
                              <div className="mb-1.5 h-3 w-16 animate-pulse rounded bg-muted/50" />
                              <div className="h-6 w-10 animate-pulse rounded bg-muted/60" />
                              <div className="mt-2 h-2.5 w-24 animate-pulse rounded bg-muted/40" />
                            </div>
                          ))}
                        </div>
                        <div className="-mx-2 border-y border-border bg-card p-2">
                          <div className="grid grid-cols-2 gap-1">
                            {Array.from({ length: 6 }).map((_, i) => (
                              <div
                                key={i}
                                className="min-h-[100px] animate-pulse rounded-md border border-border bg-muted/30"
                              />
                            ))}
                          </div>
                        </div>
                      </div>
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
          setBriefPlanId(plan.id);
          setPickerOpen(false);
          setBriefOpen(true);
        }}
        onAddContent={handleAddContent}
      />

      <MobilePlanBriefSheet
        open={briefOpen}
        onOpenChange={(open) => {
          setBriefOpen(open);
          if (!open) {
            setBriefPlanId(null);
            if (multiPlanDay) {
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
                service: briefPlan.service,
              }
            : null
        }
        showBackToPicker={multiPlanDay}
        onBackToPicker={() => {
          setBriefOpen(false);
          setBriefPlanId(null);
          setPickerOpen(true);
        }}
      />

      <AddContentDialog
        open={showAddContentDialog}
        onOpenChange={(open) => {
          setShowAddContentDialog(open);
          if (!open) setEditingPlan(null);
        }}
        selectedDate={selectedDate}
        editingPlan={editingPlan}
      />
    </SidebarProvider>
  );
}

function MobileContentCalendarPageInner() {
  useStatusBarStyle("light");
  const { isKeyboardShellOpen } = useVisualViewport();
  const { outerShellClassName, mainShellClassName, mainShellStyle } = useMobileToolsShellLayout();
  const pagePath = MOBILE_PAGE_PATH.digitalMarketingContentCalendar;
  const { hasPageAccess, showDenyShellHeader } = useToolsMobilePageAccess(pagePath);

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

  return <MobileContentCalendarPageContent hasPageAccess={hasPageAccess} />;
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
