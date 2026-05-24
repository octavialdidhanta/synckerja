import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useDebouncedReady } from '@/shared/hooks/useDebouncedReady';
import { cn } from '@/shared/lib/utils';
import { useSocialMediaData, useSocialMediaMutations } from '@/6-1-dashboard/hook/useOptimizedSocialMediaState';
import { ContentPlan } from '@/6-1-dashboard/types/social-media';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from 'date-fns';
import { HeaderAndTab } from './container/HeaderAndTab';
import { CalendarHeader } from './container/CalendarHeader';
import { CalendarStats } from './container/CalendarStats';
import { CalendarGrid } from './container/CalendarGrid';
import { CalendarGridFooter } from './container/CalendarGridFooter';
import { DayDetailsDialog } from './container/DayDetailsDialog';
import { ContentCalendarOverview } from './container/ContentCalendarOverview';
import { AddContentDialog } from './modal/AddContentDialog';
import { RealtimeSocialMediaProvider } from '@/6-1-dashboard/hook/RealtimeSocialMediaProvider';
import OptimizedErrorBoundary from '@/6-1-dashboard/components/OptimizedErrorBoundary';
import { PICFilterProvider } from '@/6-1-dashboard/context/PICFilterContext';
import GoogleDriveLinkDialog from '@/6-1-dashboard/modal/GoogleDriveLinkDialog';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { useSyncPicProduction } from '@/6-1-dashboard/hook/useSyncPicProduction';
import {
  getGoogleDriveLinkNonEmptyUpdates,
  getProductionResubmitAfterRevisionUpdates,
} from '@/6-1-dashboard/utils/googleDriveLinkSavePolicy';
import { toast } from 'sonner';
import { devLog } from '@/shared/lib/logger';
import { ContentCalendarPageSkeleton } from './skeletons/ContentCalendarPageSkeleton';
import { ModuleShellContentGate } from '@/shared/layouts/ModuleShellContentGate';
import { useModulePageOverlaySkeleton } from '@/shared/auth/page-access/useModulePageOverlaySkeleton';

const ContentCalendarContent: React.FC = () => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [showDayDialog, setShowDayDialog] = useState(false);
  const [showAddContentDialog, setShowAddContentDialog] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState('content-calendar');
  const [selectedService, setSelectedService] = useState<string>('all');
  const [previewPlanId, setPreviewPlanId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { loading: orgBootstrapPending, organizationId: activeOrgId } = useCurrentOrg();
  const { contentPlans, services, isLoading: socialDataLoading } = useSocialMediaData();
  const { addContentPlan, refreshMasterData, updateContentPlan } = useSocialMediaMutations();

  const dataPending = Boolean(activeOrgId) && socialDataLoading;
  const rawPendingLoad = orgBootstrapPending || dataPending;
  const { showFullPageSkeleton } = useModulePageOverlaySkeleton(
    rawPendingLoad,
    '/digital-marketing/social-media/content-calendar',
  );
  const showContent = useDebouncedReady(!showFullPageSkeleton, 220);
  const { data: currentEmployee } = useCurrentEmployee();
  const { syncPicProduction } = useSyncPicProduction();

  const handleProductionResubmitForReview = useCallback(
    (planId: string) => {
      updateContentPlan(planId, getProductionResubmitAfterRevisionUpdates());
    },
    [updateContentPlan]
  );

  const handleCarouselFirstUploadSuccess = useCallback(
    (planId: string) => {
      const plan = contentPlans.find((p) => p.id === planId);
      if (plan?.pic_production_source === 'task_steps_assigned') return;
      const employeeId = currentEmployee?.id;
      if (!employeeId) return;
      updateContentPlan(planId, {
        pic_production_id: employeeId,
        pic_production_source: 'google_drive_link',
        production_status: 'Need Review',
        production_completion_date: new Date().toISOString(),
      });
    },
    [contentPlans, currentEmployee?.id, updateContentPlan]
  );

  const handleCarouselAllRemoved = useCallback(
    async (planId: string) => {
      const plan = contentPlans.find((p) => p.id === planId);
      if (!plan) return;
      try {
        await syncPicProduction(planId, null, plan.pic_production_id, plan.pic_production_source);
        updateContentPlan(planId, {
          production_status: null,
          production_completion_date: null,
        });
      } catch (error) {
        devLog.error('Error resetting PIC Production after carousel all removed (calendar):', error);
      }
    },
    [contentPlans, syncPicProduction, updateContentPlan]
  );

  // Filter content plans by selected service
  const filteredContentPlans = useMemo(() => {
    if (selectedService === 'all') {
      return contentPlans;
    }
    return contentPlans.filter(plan => plan.service_id === selectedService);
  }, [contentPlans, selectedService]);

  const previewPlan = useMemo(() => {
    if (!previewPlanId) return null;
    return (
      filteredContentPlans.find((p) => p.id === previewPlanId) ??
      contentPlans.find((p) => p.id === previewPlanId) ??
      null
    );
  }, [previewPlanId, filteredContentPlans, contentPlans]);

  // Calendar calculations
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Calculate calendar grid (including previous/next month days for complete weeks)
  const startDay = monthStart.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const daysFromPrevMonth = startDay === 0 ? 0 : startDay; // Adjust for Monday start
  const totalCells = Math.ceil((daysInMonth.length + daysFromPrevMonth) / 7) * 7;
  
  const calendarDays = [];
  
  // Add days from previous month
  const prevMonth = subMonths(currentDate, 1);
  const prevMonthEnd = endOfMonth(prevMonth);
  for (let i = daysFromPrevMonth - 1; i >= 0; i--) {
    const day = new Date(prevMonthEnd);
    day.setDate(prevMonthEnd.getDate() - i);
    calendarDays.push({ date: day, isCurrentMonth: false });
  }
  
  // Add days from current month
  daysInMonth.forEach(day => {
    calendarDays.push({ date: day, isCurrentMonth: true });
  });
  
  // Add days from next month to complete the grid
  const nextMonth = addMonths(currentDate, 1);
  const remainingCells = totalCells - calendarDays.length;
  for (let i = 1; i <= remainingCells; i++) {
    const day = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), i);
    calendarDays.push({ date: day, isCurrentMonth: false });
  }

  // Process content plans for the calendar (using filtered content plans)
  const plansByDate = useMemo(() => {
    const plans: { [key: string]: ContentPlan[] } = {};
    
    filteredContentPlans.forEach(plan => {
      if (plan.post_date) {
        const dateKey = format(new Date(plan.post_date), 'yyyy-MM-dd');
        if (!plans[dateKey]) plans[dateKey] = [];
        plans[dateKey].push(plan);
      }
    });
    
    return plans;
  }, [filteredContentPlans]);

  // Calculate day status and color based on approved, production_approved, done, and on_time_status
  const getDayInfo = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const plansForDay = plansByDate[dateKey] || [];
    
    if (plansForDay.length === 0) return { color: '', count: 0, status: 'empty', plans: [], lateText: null };
    
    // Note: We no longer apply color to the day card itself, only to individual plan cards
    
    // Determine color based on plan status
    // Priority: Check each plan and determine the most critical status
    let hasRed = false;      // approved = FALSE + production_approved = false + done = false
    let hasOrange = false;   // approved = TRUE + production_approved = false + done = false
    let hasYellow = false;   // approved = TRUE + production_approved = TRUE + done = false
    let hasGreen = false;    // approved = TRUE + production_approved = TRUE + done = True
    let hasGreenWithLate = false; // approved = TRUE + production_approved = TRUE + done = True + on_time_status != "Ontime" and != NULL/Empty
    let lateText: string | null = null;
    
    plansForDay.forEach(plan => {
      const approved = plan.approved === true;
      const productionApproved = plan.production_approved === true;
      const done = plan.done === true;
      const onTimeStatus = plan.on_time_status;
      
      // Check if on_time_status is not "Ontime" and not NULL/Empty
      const hasLateStatus = onTimeStatus && 
                           onTimeStatus.trim() !== '' && 
                           onTimeStatus !== 'Ontime' &&
                           onTimeStatus.toLowerCase().includes('late');
      
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
          // Store the late text (e.g., "Late 1 Day", "Late 2 Days")
          lateText = onTimeStatus;
        }
      }
    });
    
    // Return status based on priority (most critical first)
    // Note: color is no longer used for day card background, only for reference
    if (hasRed) {
      return { 
        color: '', 
        count: plansForDay.length, 
        status: 'red', 
        plans: plansForDay,
        lateText: null
      };
    }
    if (hasOrange) {
      return { 
        color: '', 
        count: plansForDay.length, 
        status: 'orange', 
        plans: plansForDay,
        lateText: null
      };
    }
    if (hasYellow) {
      return { 
        color: '', 
        count: plansForDay.length, 
        status: 'yellow', 
        plans: plansForDay,
        lateText: null
      };
    }
    if (hasGreenWithLate) {
      return { 
        color: '', 
        count: plansForDay.length, 
        status: 'green-late', 
        plans: plansForDay,
        lateText: lateText
      };
    }
    if (hasGreen) {
      return { 
        color: '', 
        count: plansForDay.length, 
        status: 'green', 
        plans: plansForDay,
        lateText: null
      };
    }
    
    // Default fallback
    return { 
      color: '', 
      count: plansForDay.length, 
      status: 'planned', 
      plans: plansForDay,
      lateText: null
    };
  };

  // Calculate statistics for current month based on approved, production_approved, done, and on_time_status
  const monthlyStats = useMemo(() => {
    const currentMonthPlans = filteredContentPlans.filter(plan => {
      if (!plan.post_date) return false;
      const postDate = new Date(plan.post_date);
      return postDate.getMonth() === currentDate.getMonth() && 
             postDate.getFullYear() === currentDate.getFullYear();
    });

    // Count plans by status based on approved, production_approved, done, and on_time_status
    let redCount = 0;      // approved = FALSE + production_approved = false + done = false
    let orangeCount = 0;   // approved = TRUE + production_approved = false + done = false
    let yellowCount = 0;   // approved = TRUE + production_approved = TRUE + done = false
    let greenCount = 0;    // approved = TRUE + production_approved = TRUE + done = True
    let greenWithLateCount = 0; // approved = TRUE + production_approved = TRUE + done = True + on_time_status != "Ontime" and != NULL/Empty

    currentMonthPlans.forEach(plan => {
      const approved = plan.approved === true;
      const productionApproved = plan.production_approved === true;
      const done = plan.done === true;
      const onTimeStatus = plan.on_time_status;
      
      // Check if on_time_status is not "Ontime" and not NULL/Empty
      const hasLateStatus = onTimeStatus && 
                           onTimeStatus.trim() !== '' && 
                           onTimeStatus !== 'Ontime' &&
                           onTimeStatus.toLowerCase().includes('late');
      
      if (!approved && !productionApproved && !done) {
        redCount++;
      } else if (approved && !productionApproved && !done) {
        orangeCount++;
      } else if (approved && productionApproved && !done) {
        yellowCount++;
      } else if (approved && productionApproved && done) {
        if (hasLateStatus) {
          greenWithLateCount++;
        } else {
          greenCount++;
        }
      }
    });

    return { 
      red: redCount,
      orange: orangeCount,
      yellow: yellowCount,
      green: greenCount,
      greenWithLate: greenWithLateCount,
      total: currentMonthPlans.length 
    };
  }, [filteredContentPlans, currentDate]);

  // Handle day click
  const handleDayClick = (date: Date, dayInfo: any) => {
    setSelectedDate(date);
    setSelectedPlan(null); // Reset selected plan when clicking on day
    setShowDayDialog(true);
  };

  // Handle plan card click (when there are multiple plans in a day)
  const handlePlanClick = (date: Date, plan: any) => {
    setSelectedDate(date);
    setSelectedPlan(plan); // Set the specific plan that was clicked
    setShowDayDialog(true);
  };

  // Handle adding new content
  const handleAddContent = async (date: Date) => {
    setSelectedDate(date);
    setEditingPlan(null); // Reset editing plan for create mode
    setShowDayDialog(false);
    setShowAddContentDialog(true);
  };

  // Handle editing content
  const handleEditContent = (plan: any) => {
    setEditingPlan(plan);
    // Set selected date from plan's post_date
    if (plan.post_date) {
      setSelectedDate(new Date(plan.post_date));
    }
    setShowDayDialog(false);
    setShowAddContentDialog(true);
  };

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const handleTabChange = (newTab: string) => {
    setActiveMainTab(newTab);
    navigate(`/digital-marketing/social-media/${newTab}`);
  };

  const handleMasterDataChange = async () => {
    try {
      await refreshMasterData();
    } catch (error) {
      console.error('Error refreshing master data:', error);
    }
  };

  // Calculate footer data
  const calendarFooterData = useMemo(() => {
    const currentMonthDays = daysInMonth.length;
    const daysWithContent = daysInMonth.filter(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      return plansByDate[dateKey] && plansByDate[dateKey].length > 0;
    }).length;
    const totalPostsInMonth = filteredContentPlans.filter(plan => {
      if (!plan.post_date) return false;
      const postDate = new Date(plan.post_date);
      return postDate.getMonth() === currentDate.getMonth() && 
             postDate.getFullYear() === currentDate.getFullYear();
    }).length;

    return {
      totalDays: currentMonthDays,
      activeDays: daysWithContent,
      totalPosts: totalPostsInMonth
    };
  }, [daysInMonth, plansByDate, filteredContentPlans, currentDate]);

  return (
    <>
      <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col px-4 pb-2',
            !showContent && 'pointer-events-none invisible select-none',
          )}
          aria-hidden={!showContent}
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-h-full flex-col">
                <div className="mb-1 flex-shrink-0">
                  <HeaderAndTab
                    activeMainTab={activeMainTab}
                    handleTabChange={handleTabChange}
                  />
                </div>

                <ModuleShellContentGate pagePath="/digital-marketing/social-media/content-calendar">
                <div className="grid min-h-[calc(100vh-120px)] max-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 overflow-hidden [grid-template-rows:minmax(0,1fr)] items-stretch">
                  <div className="col-span-9 flex min-h-0 w-full min-w-0 flex-col gap-1 overflow-hidden">
                    <div className="flex-shrink-0">
                      <div className="rounded-md border bg-white p-2">
                        <CalendarHeader
                          currentDate={currentDate}
                          onPrevMonth={handlePrevMonth}
                          onNextMonth={handleNextMonth}
                          services={Array.isArray(services) ? services : []}
                          selectedService={selectedService}
                          onServiceChange={setSelectedService}
                        />
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      <CalendarStats monthlyStats={monthlyStats} />
                    </div>

                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 max-h-[calc(100vh-320px)] flex-1 overflow-y-auto overflow-x-auto p-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <CalendarGrid
                          calendarDays={calendarDays}
                          getDayInfo={getDayInfo}
                          onDayClick={handleDayClick}
                          onPlanClick={handlePlanClick}
                          onOpenPreview={(plan) => {
                            if (plan?.id) setPreviewPlanId(plan.id);
                          }}
                        />
                      </div>

                      <div className="flex-shrink-0 border-t border-gray-200 bg-white">
                        <CalendarGridFooter
                          totalDays={calendarFooterData.totalDays}
                          activeDays={calendarFooterData.activeDays}
                          totalPosts={calendarFooterData.totalPosts}
                          onContentTypeDataChange={handleMasterDataChange}
                          onServiceDataChange={handleMasterDataChange}
                          onContentPillarDataChange={handleMasterDataChange}
                          onSocialMediaNameDataChange={() => {}}
                          services={Array.isArray(services) ? services : []}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="col-span-3 flex min-h-0 w-full min-w-0 flex-col overflow-hidden">
                    <ContentCalendarOverview
                      monthlyStats={monthlyStats}
                      plansByDate={plansByDate}
                      contentPlans={filteredContentPlans}
                      currentDate={currentDate}
                      serviceFilter={selectedService}
                      services={Array.isArray(services) ? services : []}
                    />
                  </div>
                </div>
                </ModuleShellContentGate>

                <div
                  className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
                  aria-hidden
                />
              </div>
            </div>
          </div>
        </div>

        {!showContent ? (
          <div
            className="absolute inset-0 z-20 flex min-h-0 min-w-0 flex-col overflow-hidden bg-gray-100"
            aria-busy
          >
            <ContentCalendarPageSkeleton />
          </div>
        ) : null}
      </div>

      {/* Day Details Dialog */}
      <DayDetailsDialog
        open={showDayDialog}
        onOpenChange={(open) => {
          setShowDayDialog(open);
          if (!open) {
            // Reset selected plan when dialog closes
            setSelectedPlan(null);
          }
        }}
        selectedDate={selectedDate}
        plansByDate={plansByDate}
        onAddContent={handleAddContent}
        onEditContent={handleEditContent}
        selectedPlan={selectedPlan}
      />

      {/* Add/Edit Content Dialog */}
      <AddContentDialog
        open={showAddContentDialog}
        onOpenChange={(open) => {
          setShowAddContentDialog(open);
          if (!open) {
            // Reset editing plan when dialog closes
            setEditingPlan(null);
          }
        }}
        selectedDate={selectedDate}
        editingPlan={editingPlan}
      />

      {previewPlan && (
        <GoogleDriveLinkDialog
          isOpen
          onClose={() => setPreviewPlanId(null)}
          googleDriveLink={previewPlan.google_drive_link || ''}
          productionApproved={previewPlan.production_approved || false}
          productionStatus={previewPlan.production_status ?? undefined}
          revisionBaselineLink={previewPlan.production_revision_baseline_link ?? null}
          onResubmitForReview={() => handleProductionResubmitForReview(previewPlan.id)}
          onSave={async (link) => {
            const normalized = link?.trim() ? link.trim() : null;
            if (!normalized) {
              const plan = previewPlan;
              if (plan.pic_production_source === 'google_drive_link') {
                try {
                  await syncPicProduction(
                    previewPlan.id,
                    null,
                    plan.pic_production_id,
                    plan.pic_production_source
                  );
                } catch (error) {
                  devLog.error('Error syncing pic_production_id (calendar clear link):', error);
                }
              }
              updateContentPlan(previewPlan.id, {
                google_drive_link: null,
                production_completion_date: null,
                production_status: null,
              });
              return;
            }
            const patch = getGoogleDriveLinkNonEmptyUpdates(
              previewPlan,
              normalized,
              currentEmployee?.id
            );
            if (Object.keys(patch).length === 0) return;
            const needsPicToast =
              patch.production_status === 'Need Review' &&
              !currentEmployee?.id &&
              previewPlan.pic_production_source !== 'task_steps_assigned';
            updateContentPlan(previewPlan.id, patch);
            if (needsPicToast) {
              toast.warning(
                'Google Drive link saved, but could not auto-assign PIC Production (employee not found)'
              );
            }
          }}
          socialMediaPlanId={previewPlan.id}
          planTitle={previewPlan.title ?? undefined}
          contentTitle={previewPlan.title ?? undefined}
          contentType={previewPlan.content_type?.name}
          postDate={previewPlan.post_date ?? undefined}
          serviceName={previewPlan.service?.name ?? null}
          picProductionName={previewPlan.pic_production?.full_name ?? null}
          onApprove={() => {
            updateContentPlan(previewPlan.id, {
              production_approved: true,
              production_approved_date: new Date().toISOString(),
              production_status: 'Approved',
            });
          }}
          onCarouselChange={() => {
            queryClient.invalidateQueries({ queryKey: ['social-media-carousel'] });
            queryClient.invalidateQueries({ queryKey: ['social-media-plans'] });
          }}
          onCarouselFirstUploadSuccess={handleCarouselFirstUploadSuccess}
          onCarouselAllRemoved={handleCarouselAllRemoved}
        />
      )}
    </>
  );
};

// Main export with providers (matching SocialMediaDashboardPage pattern)
const ContentCalendarPage = () => {
  return (
    <OptimizedErrorBoundary>
      <RealtimeSocialMediaProvider>
        <PICFilterProvider>
          <ContentCalendarContent />
        </PICFilterProvider>
      </RealtimeSocialMediaProvider>
    </OptimizedErrorBoundary>
  );
};

export default ContentCalendarPage;