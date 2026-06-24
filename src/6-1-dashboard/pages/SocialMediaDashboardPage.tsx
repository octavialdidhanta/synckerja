import React, { useState, useCallback, useEffect, useRef, useDeferredValue, useMemo } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { PageAccessContentGate } from '@/shared/components/PageAccessContentGate';
import { Tabs, TabsContent } from "@/shared/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from '@/shared/lib/supabaseClient';
import { devLog } from '@/shared/lib/logger';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SocialMediaErrorBoundary } from "../hook/ErrorBoundary";
import { RealtimeSocialMediaProvider } from "../hook/RealtimeSocialMediaProvider";
import OptimizedErrorBoundary from "@/6-1-dashboard/components/OptimizedErrorBoundary";
import { PICFilterProvider } from "../context/PICFilterContext";

import { HeaderAndTab } from '../container/HeaderAndTab';
import { SocialMediaMetrics } from '../container/SocialMediaMetrics';
import { SocialMediaPerformanceTabs } from '../container/SocialMediaPerformanceTabs';
import { SocialMediaFilters } from '../container/SocialMediaFilters';
import { ContentPlanTable } from '../container/ContentPlanTable';
import { TableFooter } from '../container/TableFooter';
import { SidebarContainer } from '../container/RightSection/SidebarContainer';
import { DashboardDataPreloader } from '../container/DashboardDataPreloader';
import { SocialMediaDashboardSkeleton } from '../skeletons/SocialMediaDashboardSkeleton';
import { getDailyTasksRemindersQueryOptions, getAllSocialMediaLinksQueryOptions, buildLinksByPlanId } from '../data/dashboardQueryOptions';
import { buildScheduleByPlanId, useOrgActiveSchedules } from '@/6-1-scheduled-posts/hooks/useOrgActiveSchedules';
import { useSocialMediaDashboardSkeletonGate } from '../hook/useSocialMediaDashboardSkeletonGate';
import { useEmployeeTargets } from '../hook/useEmployeeTargets';
import { useOrgBootstrapPending } from '@/shared/auth/hooks/useOrgBootstrapPending';

import BriefDialog from '../modal/BriefDialog';
import TitleDialog from '../modal/TitleDialog';
import EditTargetDialog from '../modal/EditTargetDialog';
import GoogleDriveLinkDialog from '../modal/GoogleDriveLinkDialog';
import type { ContentPlan } from '../types/social-media';
import {
  getGoogleDriveLinkNonEmptyUpdates,
  getProductionResubmitAfterRevisionUpdates,
} from '../utils/googleDriveLinkSavePolicy';

// Import optimized hooks
import { useSocialMediaData, useSocialMediaMutations } from "../hook/useOptimizedSocialMediaState";
import { useContentPlannerEmployees } from "../hook/useContentPlannerEmployees";
import { useCreativeProductionEmployees } from "../hook/useCreativeProductionEmployees";
import { useOptimizedFiltering } from "../hook/useOptimizedFiltering";
import { setBriefModalOpenPlanId } from "../hook/briefModalOpenRef";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { useDigitalMarketingEmployees } from "../hook/useDigitalMarketingEmployees";
import { useBatchApprovalAccess } from "../hook/useBatchApprovalAccess";
import { useSyncPicProduction } from "../hook/useSyncPicProduction";
import { useApprovalTaskStepCreation } from "../hook/useApprovalTaskStepCreation";
import DailyTaskSelectorDialog from "../modal/DailyTaskSelectorDialog";
import {
  planNeedsStaleMetadataSync,
  syncPlanCompletionStateClient,
} from '@/6-1-scheduled-posts/lib/syncPlanCompletionStateClient';

const SocialMediaContent = () => {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { orgBootstrapPending } = useOrgBootstrapPending();
  
  // Get data from context
  const {
    contentPlans,
    contentTypes,
    services,
    subServices,
    contentPillars,
    isLoading: loading,
    error: dataError,
    organizationId,
    formatDisplayDate,
    getFilteredSubServices,
    getFilteredContentPlans
  } = useSocialMediaData();

  // Get mutations from context
  const {
    updateContentPlan,
    addContentPlan,
    deleteContentPlan,
    refreshAll,
    refreshMasterData
  } = useSocialMediaMutations();
  
  // Other data hooks
  const { contentPlanners } = useContentPlannerEmployees();
  const { creativeProductionMembers } = useCreativeProductionEmployees();
  const {
    userRole: currentUserRole,
    employee: currentEmployee,
    loading: centralizedUserLoading,
  } = useCentralizedUserData();
  const currentEmployeeId = currentEmployee?.id;
  const {
    data: digitalEmployees = [],
    isPending: digitalEmployeesPending,
  } = useDigitalMarketingEmployees();
  const { isLoading: employeeTargetsLoading } = useEmployeeTargets();

  // Sync PIC Production hook
  const { syncPicProduction, syncAllExistingPlans } = useSyncPicProduction();
  
  // Batch check approval access (optimized - single check for all rows)
  const approvalAccess = useBatchApprovalAccess();

  /** Blocks handleFieldChange for a plan while approval modal is open; cleared in onUpdate/onRollback */
  const pendingApprovalPlansRef = useRef<Set<string>>(new Set());
  
  // Approval with task step creation hook
  const { 
    requestApproval, 
    isTaskSelectorOpen, 
    pendingApproval, 
    handleTaskSelected, 
    handleModalClose,
    handleUnapproval
  } = useApprovalTaskStepCreation({
    onStatusUpdate: async (planId: string, status: string) => {
      await updateContentPlan(planId, { status });
    },
    onUpdate: async (planId: string, fields: { status?: string | null; approved?: boolean; completion_date?: string | null }) => {
      // Update semua field setelah task step berhasil dibuat
      try {
        await updateContentPlan(planId, fields);
      } finally {
        // Selalu buka kembali handleFieldChange untuk baris ini (unapprove, dll.)
        pendingApprovalPlansRef.current.delete(planId);
      }
    },
    onRollback: async (planId: string, fields: { status?: string | null; approved?: boolean; completion_date?: string | null }) => {
      try {
        await updateContentPlan(planId, fields);
      } finally {
        pendingApprovalPlansRef.current.delete(planId);
      }
    }
  });

  // Fetch all social media links once for metrics + table rows (no per-row queries)
  const { data: allSocialMediaLinks = [], isPending: socialLinksPending } = useQuery(
    getAllSocialMediaLinksQueryOptions(organizationId),
  );

  const linksByPlanId = useMemo(
    () => buildLinksByPlanId(allSocialMediaLinks),
    [allSocialMediaLinks],
  );

  const { data: activeSchedules = [] } = useOrgActiveSchedules(organizationId);
  const scheduleByPlanId = useMemo(
    () => buildScheduleByPlanId(activeSchedules, linksByPlanId),
    [activeSchedules, linksByPlanId],
  );

  const { isPending: remindersPending } = useQuery(
    getDailyTasksRemindersQueryOptions(organizationId),
  );

  const hasOrg = Boolean(organizationId);
  const rawDashboardPending =
    orgBootstrapPending ||
    (hasOrg &&
      (loading ||
        digitalEmployeesPending ||
        centralizedUserLoading ||
        employeeTargetsLoading ||
        socialLinksPending ||
        remindersPending ||
        approvalAccess.loading));

  const showDashboardSkeleton = useSocialMediaDashboardSkeletonGate(rawDashboardPending);

  const staleMetadataSyncRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!organizationId || showDashboardSkeleton || contentPlans.length === 0) return;

    const stalePlans = contentPlans.filter((plan) => {
      if (staleMetadataSyncRef.current.has(plan.id)) return false;
      return planNeedsStaleMetadataSync(plan);
    });

    if (stalePlans.length === 0) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      for (const plan of stalePlans.slice(0, 25)) {
        if (cancelled) break;
        staleMetadataSyncRef.current.add(plan.id);
        await syncPlanCompletionStateClient(plan.id);
      }
      if (!cancelled) {
        await queryClient.invalidateQueries({ queryKey: ['content-plans'] });
        await queryClient.invalidateQueries({ queryKey: ['social-media-plans'] });
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [organizationId, showDashboardSkeleton, contentPlans, queryClient]);

  // State hooks
  const [activeMainTab, setActiveMainTab] = useState("dashboard");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const VALID_STATUS_VALUES = ['all', 'Ready To Post', 'Content Need Review', 'Content Revision', 'Prod Revision', 'Prod Need Review'];
  const [statusFilter, setStatusFilterState] = useState(() => {
    const fromUrl = searchParams.get('status');
    return fromUrl && VALID_STATUS_VALUES.includes(fromUrl) ? fromUrl : 'all';
  });
  const setStatusFilter = useCallback((value: string) => {
    const next = value && VALID_STATUS_VALUES.includes(value) ? value : 'all';
    setStatusFilterState(next);
    setSearchParams((prev) => {
      const nextParams = new URLSearchParams(prev);
      if (next === 'all') nextParams.delete('status');
      else nextParams.set('status', next);
      return nextParams;
    }, { replace: true });
  }, [setSearchParams]);
  const [serviceFilter, setServiceFilter] = useState("all");
  const [activePerformanceTab, setActivePerformanceTab] = useState("content-planner");

  // Date states for performance tabs and Content Pillar Tracker filter
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isMonthSelectorOpen, setIsMonthSelectorOpen] = useState(false);
  // Deferred month for filtering/table/sidebar so dropdown updates immediately without blocking
  const deferredMonth = useDeferredValue(selectedMonth);

  // Edit Target Dialog States
  const [isEditTargetOpen, setIsEditTargetOpen] = useState(false);
  const [editingManager, setEditingManager] = useState<{ id: string; name: string } | null>(null);
  const [targetType, setTargetType] = useState<'content_planning' | 'content_production' | 'content_posting'>('content_planning');

  // Brief and Title Dialog States
  const [briefDialog, setBriefDialog] = useState<{
    isOpen: boolean;
    id: string;
    brief: string | null;
  }>({
    isOpen: false,
    id: "",
    brief: null
  });
  const [titleDialog, setTitleDialog] = useState<{
    isOpen: boolean;
    id: string;
    title: string | null;
    approved?: boolean;
  }>({
    isOpen: false,
    id: "",
    title: null,
    approved: undefined
  });

  // Notification bell: open preview modal for this plan id (instead of public page)
  const [notificationPreviewPlanId, setNotificationPreviewPlanId] = useState<string | null>(null);

  // Fetch single plan when opening preview from notification (plan may not be in current table filter)
  const PLAN_SELECT = `
    id, organization_id, post_date, content_type_id, pic_id, service_id, sub_service_id, title, content_pillar_id, brief, status, revision_count, approved, completion_date, pic_production_id, pic_production_source, google_drive_link, production_revision_baseline_link, production_status, production_revision_count, production_completion_date, production_approved, production_approved_date, post_link, post_link_created_by, done, actual_post_date, on_time_status, status_content, created_at, updated_at,
    content_type:content_types(id, name), service:services(id, name), sub_service:sub_services(id, name), content_pillar:content_pillars(id, name, color), pic:employees!social_media_plans_pic_id_fkey(id, full_name), pic_production:employees!social_media_plans_pic_production_id_fkey(id, full_name), post_link_creator:employees!social_media_plans_post_link_created_by_fkey(id, full_name)
  `;
  const { data: notificationPreviewPlanFetched } = useQuery({
    queryKey: ['social-media-plan', notificationPreviewPlanId],
    enabled: !!notificationPreviewPlanId && !!organizationId,
    refetchOnWindowFocus: false, // Disabled to prevent reload when switching windows
    queryFn: async (): Promise<ContentPlan | null> => {
      if (!notificationPreviewPlanId || !organizationId) return null;
      const { data, error } = await supabase
        .from('social_media_plans')
        .select(PLAN_SELECT)
        .eq('id', notificationPreviewPlanId)
        .eq('organization_id', organizationId)
        .single();
      if (error || !data) return null;
      return data as unknown as ContentPlan;
    },
    staleTime: 10000,
  });

  const notificationPreviewPlan: ContentPlan | null = notificationPreviewPlanId
    ? (contentPlans.find((p) => p.id === notificationPreviewPlanId) as ContentPlan | undefined) ?? notificationPreviewPlanFetched ?? null
    : null;

  useEffect(() => {
    if (!notificationPreviewPlanId) return;
    queryClient.invalidateQueries({ queryKey: ['link-comments', notificationPreviewPlanId] });
  }, [notificationPreviewPlanId, queryClient]);

  // When user opens /review/:token while logged in, they are redirected here with ?review=TOKEN — resolve token and open preview modal
  const reviewTokenFromUrl = searchParams.get('review');
  useEffect(() => {
    if (!reviewTokenFromUrl?.trim()) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc('get_public_review_content_by_token', {
        token_param: reviewTokenFromUrl.trim(),
      });
      if (cancelled) return;
      if (error || !data || typeof data !== 'object') {
        toast.error('Invalid or expired review link');
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.delete('review');
          return next;
        }, { replace: true });
        return;
      }
      const payload = data as { social_media_plan_id?: string };
      const planId = payload?.social_media_plan_id;
      if (planId) {
        setNotificationPreviewPlanId(planId);
      }
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('review');
        return next;
      }, { replace: true });
    })();
    return () => { cancelled = true; };
  }, [reviewTokenFromUrl, setSearchParams]);

  // Define tab configurations
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', path: '/digital-marketing/social-media/dashboard' },
    { id: 'content-calendar', label: 'Content Calendar', path: '/digital-marketing/social-media/content-calendar' },
    { id: 'settings', label: 'Settings', path: '/digital-marketing/social-media/settings' }
  ];

  // Set active tab based on URL parameter
  useEffect(() => {
    const validTabs = tabs.map(t => t.id);
    
    if (tab && validTabs.includes(tab)) {
      setActiveMainTab(tab);
    } else if (!tab) {
      // No tab specified, redirect to dashboard
      navigate('/digital-marketing/social-media/dashboard', { replace: true });
    }
  }, [tab, navigate]);

  // Sync existing plans on mount (only once when organizationId is available and data is loaded)
  // Use ref to prevent multiple syncs
  const hasSyncedRef = useRef(false);
  useEffect(() => {
    if (!organizationId || loading || showDashboardSkeleton || hasSyncedRef.current) return;
    
    // Mark as synced to prevent multiple calls
    hasSyncedRef.current = true;
    
    // Sync existing plans in background (don't block UI)
    // Add small delay to ensure data is loaded
    const timeoutId = setTimeout(() => {
      syncAllExistingPlans().catch(error => {
        devLog.error('Error syncing existing plans:', error);
        hasSyncedRef.current = false;
        toast.warning('Background sync failed. Refresh the page to retry.');
      });
    }, 1000); // 1 second delay to ensure data is loaded
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [organizationId, loading, showDashboardSkeleton, syncAllExistingPlans]);

  const handleTabChange = (newTab: string) => {
    setActiveMainTab(newTab);
    navigate(`/digital-marketing/social-media/${newTab}`);
  };

  // Filtered content plans - use deferredMonth so dropdown (selectedMonth) updates immediately
  const filteredContentPlans = useOptimizedFiltering(
    loading ? [] : contentPlans, 
    searchTerm, 
    statusFilter,
    deferredMonth,
    serviceFilter
  );

  // Calculate metrics from contentPlans filtered by active performance tab
  // Return default metrics during loading to prevent flicker
  const metrics = React.useMemo(() => {
    // Return default metrics during initial load to prevent flicker
    if (loading || !contentPlans.length) {
      return {
        dailyOverdueContent: 0,
        dailyCompletedContent: 0,
        dailyRevisedContent: 0,
        dailyTotalContent: 0,
        monthlyOverdueContent: 0,
        monthlyCompletedContent: 0,
        monthlyRevisedContent: 0,
        monthlyTotalContent: 0,
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison
    // Use local date to avoid timezone issues
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayDateString = `${year}-${month}-${day}`; // Format: YYYY-MM-DD (local timezone)
    
    // Use deferredMonth for metrics so dropdown stays responsive
    const filterDate = deferredMonth || today;
    const currentMonth = filterDate.getMonth();
    const currentYear = filterDate.getFullYear();

    // Filter plans based on active performance tab
    let filteredPlans = contentPlans;
    
    if (activePerformanceTab === 'content-planner') {
      // Content Planner: Filter by pic_id (content planner PIC)
      filteredPlans = contentPlans.filter(plan => plan.pic_id !== null && plan.pic_id !== undefined);
    } else if (activePerformanceTab === 'production') {
      // Production: Filter by pic_production_id (production PIC)
      filteredPlans = contentPlans.filter(plan => plan.pic_production_id !== null && plan.pic_production_id !== undefined);
    } else if (activePerformanceTab === 'content-post') {
      // Content Post: Filter by pic_id (same as Content Planner, but metrics will check done or social_media_links)
      filteredPlans = contentPlans.filter(plan => plan.pic_id !== null && plan.pic_id !== undefined);
    }
    // else: show all plans (default behavior)

    // Helper function to extract date string from date value (robust parsing)
    const getDateString = (dateValue: string | Date | null | undefined): string | null => {
      if (!dateValue) return null;
      
      try {
        if (typeof dateValue === 'string') {
          // If already in YYYY-MM-DD format, return as is
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
            return dateValue;
          }
          // If contains 'T', split and take date part
          if (dateValue.includes('T')) {
            return dateValue.split('T')[0];
          }
          // If contains space, split and take date part (format: "YYYY-MM-DD HH:mm:ss")
          if (dateValue.includes(' ')) {
            return dateValue.split(' ')[0];
          }
          // Otherwise, try to parse it
          const date = new Date(dateValue);
          if (!isNaN(date.getTime())) {
            // Use local date to avoid timezone issues
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          }
        }
        
        if (dateValue instanceof Date) {
          if (!isNaN(dateValue.getTime())) {
            // Use local date to avoid timezone issues
            const year = dateValue.getFullYear();
            const month = String(dateValue.getMonth() + 1).padStart(2, '0');
            const day = String(dateValue.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          }
        }
      } catch (e) {
        // Silently fail and return null
      }
      
      return null;
    };

    // Filter plans by day - use today's date string for exact match
    // For Production tab, filter by production_completion_date or production_approved_date
    // For Content Post tab, filter by actual_post_date or post_date (same logic as ContentPostTab)
    // For Content Planner tab, filter by post_date
    const dailyContentPlans = filteredPlans.filter(plan => {
      if (activePerformanceTab === 'production') {
        // For Production: filter by production completion/approval date
        // Priority: production_approved_date > production_completion_date > post_date (if approved)
        // AND must have production_approved === true
        
        // Check production_approved_date first (most reliable)
        const approvedDateStr = getDateString(plan.production_approved_date);
        if (approvedDateStr && approvedDateStr === todayDateString && plan.production_approved === true) {
          return true;
        }

        // Check production_completion_date second
        const completionDateStr = getDateString(plan.production_completion_date);
        if (completionDateStr && completionDateStr === todayDateString && plan.production_approved === true) {
          return true;
        }

        // Fallback: if production_approved is true and post_date is today
        if (plan.production_approved === true && plan.post_date) {
          const postDateStr = getDateString(plan.post_date);
          if (postDateStr && postDateStr === todayDateString) {
            return true;
          }
        }

        return false;
      } else if (activePerformanceTab === 'content-post') {
        if (plan.done !== true) return false;

        if (plan.actual_post_date) {
          const actualPostDateStr = getDateString(plan.actual_post_date);
          if (actualPostDateStr && actualPostDateStr === todayDateString) {
            return true;
          }
        }

        return false;
      } else if (activePerformanceTab === 'content-planner') {
        // For Content Planner: Priority completion_date > post_date (same logic as ContentPlannerTab)
        // Check completion_date first (most reliable - this is when content planner approved)
        if (plan.completion_date) {
          const completionDateStr = getDateString(plan.completion_date);
          if (completionDateStr && completionDateStr === todayDateString) {
            return true;
          }
        }

        // Fallback: check post_date if completion_date doesn't match or doesn't exist
        if (plan.post_date) {
          const postDateStr = getDateString(plan.post_date);
          if (postDateStr && postDateStr === todayDateString) {
            return true;
          }
        }

        return false;
      } else {
        // Default: filter by post_date
      if (!plan.post_date) return false;
        const postDateStr = getDateString(plan.post_date);
        return postDateStr === todayDateString;
      }
    });

    // Filter plans by month
    const monthlyContentPlans = filteredPlans.filter(plan => {
      if (!plan.post_date) return false;
      const postDate = new Date(plan.post_date);
      return postDate.getMonth() === currentMonth && 
             postDate.getFullYear() === currentYear;
    });

    // Helper function to calculate on-time status (same logic as ContentPlanRow)
    const calculateOnTimeStatus = (actualPostDate: string | null, postDate: string) => {
      if (!actualPostDate || !postDate) return '';
      
      try {
        const actual = new Date(actualPostDate);
        const planned = new Date(postDate);
        
        if (isNaN(actual.getTime()) || isNaN(planned.getTime())) {
          return '';
        }
        
        const diffTime = actual.getTime() - planned.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 0) {
          return 'Ontime';
        } else {
          return `Late ${diffDays} Day${diffDays > 1 ? 's' : ''}`;
        }
      } catch (error) {
        return '';
      }
    };

    // Helper function to check if content is not completed based on tab
    const isNotCompleted = (plan: any) => {
      if (activePerformanceTab === 'content-planner') {
        // Content Planner: Not completed = belum Approved
        return plan.approved !== true;
      } else if (activePerformanceTab === 'production') {
        // Production: Not completed = belum Production Approved
        return plan.production_approved !== true;
      } else if (activePerformanceTab === 'content-post') {
        // Content Post: Not completed = belum selesai Post (done === false AND tidak ada links)
        const hasLinks = allSocialMediaLinks.some(link => link.social_media_plan_id === plan.id);
        return plan.done !== true && !hasLinks;
      } else {
        // Default: not completed if not approved
        return plan.approved !== true;
      }
    };

    const getActualPostDateForPlan = (plan: any): string | null => {
      if (!plan.actual_post_date) return null;
      return getDateString(plan.actual_post_date);
    };

    const calculateOnTimeStatusForPlan = (plan: any): string => {
      if (!plan.post_date) return '';

      const stored = String(plan.on_time_status ?? '').trim();
      if (stored === 'In Progress' || stored === 'Scheduled') return stored;
      if (!plan.actual_post_date) return stored;

      if (stored === 'Ontime' || stored.includes('Late')) return stored;

      const actualPostDate = getActualPostDateForPlan(plan);
      if (!actualPostDate) return stored;

      try {
        const actual = new Date(actualPostDate);
        const planned = new Date(plan.post_date);

        if (isNaN(actual.getTime()) || isNaN(planned.getTime())) {
          return '';
        }

        const diffTime = actual.getTime() - planned.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) {
          return 'Ontime';
        }
        return `Late ${diffDays} Day${diffDays > 1 ? 's' : ''}`;
      } catch {
        return '';
      }
    };

    // Helper function to check if content is late using On Time Status calculation
    // Content is late if calculated on_time_status contains "Late" (e.g., "Late 1 Day", "Late 2 Days")
    // and must be in current month (bulan yang sedang berjalan)
    const isLatePost = (plan: any) => {
      if (!plan.post_date) return false;
      
      // Calculate on_time_status in real-time (same logic as ContentPlanRow)
      const onTimeStatus = calculateOnTimeStatusForPlan(plan);
      
      // Check if calculated on_time_status contains "Late"
      if (!onTimeStatus || !onTimeStatus.includes('Late')) {
        return false;
      }
      
      // Determine actual post date for month check (same as calculateOnTimeStatusForPlan)
      const actualPostDate = getActualPostDateForPlan(plan);
      
      if (!actualPostDate) return false;
      
      // Late Post must be in current month (bulan yang sedang berjalan)
      // Use actual_post_date to determine which month the content was posted
      const actualPostDateObj = new Date(actualPostDate);
      actualPostDateObj.setHours(0, 0, 0, 0);
      
      const isInCurrentMonth = actualPostDateObj.getMonth() === currentMonth && 
                               actualPostDateObj.getFullYear() === currentYear;
      if (!isInCurrentMonth) return false;
      
      // Content with "Late" on_time_status is considered late post
      return true;
    };

    // Helper function to check if content is approaching deadline
    // Works for all tabs: Content Planner, Production, and Content Post
    // Content approaching deadline: post_date in the next 7 days (today + 1 to today + 7) and not posted
    // Same logic for all tabs: content must not be done and must not have social media links
    // This ensures consistent "Upcoming Deadlines" value across all tabs
    const isApproachingDeadline = (plan: any) => {
      if (!plan.post_date) return false;
      
      const postDate = new Date(plan.post_date);
      postDate.setHours(0, 0, 0, 0);
      
      // Calculate days until deadline
      const daysUntilDeadline = Math.ceil((postDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      // Content is approaching deadline if post_date is between tomorrow and 7 days from now
      // AND in the current month (bulan yang sedang berjalan)
      const isInCurrentMonth = postDate.getMonth() === currentMonth && 
                               postDate.getFullYear() === currentYear;
      
      if (!isInCurrentMonth) return false;
      
      // Approaching deadline: 1 to 7 days from now (tomorrow to next week)
      const isApproaching = daysUntilDeadline >= 1 && daysUntilDeadline <= 7;
      if (!isApproaching) return false;
      
      // For "Upcoming Deadlines", use same logic for all tabs:
      // Content must not be posted (not done and no social media links)
      // This ensures the same value is displayed in Content Planner, Production, and Content Post tabs
      const hasLinks = allSocialMediaLinks.some(link => link.social_media_plan_id === plan.id);
      return plan.done !== true && !hasLinks;
    };

    // Helper function to check if content is overdue (includes both late post and approaching deadline)
    const isOverdue = (plan: any) => {
      if (!plan.post_date) return false;
      
      // Check if content is late post (post_date < today)
      if (isLatePost(plan)) return true;
      
      // Check if content is approaching deadline (1-7 days from now)
      if (isApproachingDeadline(plan)) return true;
      
      return false;
    };

    // For daily overdue, count only Late Post (post_date < today and not completed)
    const dailyLatePostPlans = filteredPlans.filter(plan => {
      if (!plan.post_date) return false;
      // Only count late post (post_date < today)
      return isLatePost(plan);
    });

    // For monthly overdue, count only Approaching Deadline (post_date in next 7 days and not completed)
    // IMPORTANT: Use all contentPlans (not filteredPlans) to ensure same value across all tabs
    // This ensures "Upcoming Deadlines" shows the same value in Content Planner, Production, and Content Post tabs
    // Only filter by approaching deadline logic (post_date in 1-7 days, not posted)
    const monthlyApproachingDeadlinePlans = contentPlans.filter(plan => {
      if (!plan.post_date) return false;
      // Only count approaching deadline (today + 1 to today + 7, in current month, not posted)
      // isApproachingDeadline uses same logic for all tabs (not done and no links)
      return isApproachingDeadline(plan);
    });

    const isCompleted = (plan: any) => {
      if (activePerformanceTab === 'content-planner') {
        return plan.approved === true || plan.done === true;
      } else if (activePerformanceTab === 'production') {
        // For Production: content is completed if production_approved is true
        // Note: dailyContentPlans already filtered by date, so we just need to check approval status
        return plan.production_approved === true || plan.done === true;
      } else if (activePerformanceTab === 'content-post') {
        // Content is completed if done=true OR has social media links (same logic as ContentPostTab)
        const hasLinks = allSocialMediaLinks.some(link => link.social_media_plan_id === plan.id);
        return plan.done === true || hasLinks;
      }
      return plan.approved === true || plan.done === true;
    };

    const needsRevision = (plan: any) => {
      if (activePerformanceTab === 'content-planner') {
        // Under Revision: Count if status is "Request Revisi" OR "Need Review"
        return plan.status === 'Request Revisi' || plan.status === 'Need Review';
      } else if (activePerformanceTab === 'production') {
        // Under Revision: Count if production_status is "Request Revision" OR "Need Review"
        return plan.production_status === 'Request Revision' || plan.production_status === 'Need Review';
      } else if (activePerformanceTab === 'content-post') {
        // Content post might not have revision status, return false for now
        return false;
      }
      return plan.status === 'Request Revisi' || plan.status === 'Need Review' || 
             plan.production_status === 'Request Revision' || plan.production_status === 'Need Review';
    };

    // For "Under Revision" daily, count content with Need Review or Request Revisi/Revision status
    // that have post_date matching today (post_date is the most reliable date for all content)
    // This is simpler and more consistent - all content has post_date, so we use that for daily filtering
    const dailyRevisedPlans = filteredPlans.filter(plan => {
      // First check if it has revision status
      if (!needsRevision(plan)) {
        return false;
      }
      
      // Then check if it has post_date matching today
      // post_date is the scheduled date and is present on all content, making it the most reliable filter
      if (!plan.post_date) return false;
      const postDateStr = getDateString(plan.post_date);
      return postDateStr === todayDateString;
    });

    return {
      dailyOverdueContent: dailyLatePostPlans.length,
      dailyCompletedContent: dailyContentPlans.filter(isCompleted).length,
      dailyRevisedContent: dailyRevisedPlans.length,
      dailyTotalContent: dailyContentPlans.length,
      monthlyOverdueContent: monthlyApproachingDeadlinePlans.length,
      monthlyCompletedContent: monthlyContentPlans.filter(isCompleted).length,
      monthlyRevisedContent: monthlyContentPlans.filter(needsRevision).length,
      monthlyTotalContent: monthlyContentPlans.length
    };
  }, [contentPlans, activePerformanceTab, allSocialMediaLinks, loading, deferredMonth]);

  // Callback handlers
  const handleSelectItem = useCallback((id: string, checked: boolean) => {
    try {
      setSelectedItems(prev => checked ? [...prev, id] : prev.filter(item => item !== id));
    } catch (error) {
      devLog.error('Error in handleSelectItem:', error);
      toast.error('Error selecting item');
    }
  }, []);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedItems.length === 0) {
      toast.error("No items selected");
      return;
    }
    if (window.confirm(`Are you sure you want to delete ${selectedItems.length} selected item(s)?`)) {
      try {
        const deletePromises = selectedItems.map(id => deleteContentPlan(id));
        await Promise.all(deletePromises);
        setSelectedItems([]);
      } catch (error) {
        devLog.error("Error deleting items:", error);
        toast.error("Error deleting items");
      }
    }
  }, [selectedItems, deleteContentPlan]);

  // Batch updates for production_approved related fields to reduce database calls
  const pendingBatchUpdatesRef = useRef<Map<string, { updates: any; timeout: NodeJS.Timeout }>>(new Map());

  const handleProductionResubmitForReview = useCallback(
    (planId: string) => {
      updateContentPlan(planId, getProductionResubmitAfterRevisionUpdates());
    },
    [updateContentPlan]
  );

  const handleFieldChange = useCallback(async (id: string, field: string, value: any) => {
    // Skip update jika plan sedang pending approval (modal task selector terbuka).
    // Unapprove harus selalu diproses: hapus flag dan lanjutkan (jangan telan update).
    if (pendingApprovalPlansRef.current.has(id)) {
      if (field === 'approved' && value === false) {
        pendingApprovalPlansRef.current.delete(id);
      } else {
        setTimeout(() => {
          pendingApprovalPlansRef.current.delete(id);
        }, 100);
        return;
      }
    }

    try {
      // Special handling untuk approved toggle yang akan trigger status change ke "Approved"
      // Check jika perlu show modal untuk memilih daily task
      if (field === 'approved' && value === true) {
        const plan = contentPlans.find(p => p.id === id);
        if (plan) {
          const oldStatus = plan.status || null;
          const oldApproved = plan.approved || false;
          const oldCompletionDate = plan.completion_date || null;
          
          // Check apakah status akan berubah ke "Approved" (dari "Need Review" atau NULL)
          const willChangeToApproved = oldStatus === 'Need Review' || oldStatus === null || oldStatus === '' || oldStatus === 'none';
          
          if (willChangeToApproved) {
            // Request approval dengan old approved dan completion_date untuk rollback
            const shouldPreventUpdate = requestApproval(plan, oldStatus, oldApproved, oldCompletionDate);
            if (shouldPreventUpdate) {
              // Mark plan sebagai pending approval untuk prevent completion_date dan status updates
              pendingApprovalPlansRef.current.add(id);
              
              // Prevent update approved, completion_date, dan status
              // Toggle akan tetap di posisi off sampai task dipilih
              return;
            }
          }
        }
      }

      // Special handling untuk status change ke "Approved"
      // Check jika perlu show modal untuk memilih daily task
      if (field === 'status' && value === 'Approved') {
        const plan = contentPlans.find(p => p.id === id);
        if (plan) {
          const oldStatus = plan.status || null;
          const oldApproved = plan.approved || false;
          const oldCompletionDate = plan.completion_date || null;
          // Request approval (akan return true jika modal dibuka)
          const shouldPreventUpdate = requestApproval(plan, oldStatus, oldApproved, oldCompletionDate);
          if (shouldPreventUpdate) {
            // Mark plan sebagai pending approval untuk prevent other updates
            pendingApprovalPlansRef.current.add(id);
            
            // Prevent normal update, tunggu task dipilih
            return;
          }
        }
      }

      // Special handling untuk status change dari "Approved" ke "Need Review" (un-approval)
      // Delete task_steps ketika status berubah dari "Approved" ke "Need Review"
      // NON-BLOCKING: jangan di-await supaya perubahan status di UI tetap cepat
      if (field === 'status' && value === 'Need Review') {
        const plan = contentPlans.find(p => p.id === id);
        if (plan && plan.status === 'Approved') {
          // Status berubah dari "Approved" ke "Need Review" - hapus task_steps di background
          handleUnapproval(id).catch((error) => {
            devLog.error('Error during unapproval task step deletion (status):', error);
            toast.error('Failed to remove approval task');
          });
        }
      }

      // Special handling untuk approved toggle yang diubah ke false (un-approval)
      // Delete Concept task_steps ketika approved diubah dari true ke false
      // NON-BLOCKING: jangan di-await supaya toggle langsung pindah ke posisi off tanpa delay
      if (field === 'approved' && value === false) {
        const plan = contentPlans.find(p => p.id === id);
        if (plan && plan.approved === true) {
          // Approved diubah dari true ke false - hapus Concept task_steps di background
          // Only Concept steps will be deleted (Content steps remain)
          handleUnapproval(id).catch((error) => {
            devLog.error('Error during unapproval Concept task step deletion:', error);
            toast.error('Failed to remove approval task');
          });
        }
      }

      // Brief cleared → align with "No Status" (status empty, un-approve, clear completion)
      if (field === 'brief') {
        const briefStr = value == null ? '' : String(value).trim();
        if (briefStr === '') {
          updateContentPlan(id, {
            brief: '',
            status: '',
            completion_date: null,
            approved: false,
          });
          return;
        }
      }

      // Google Drive link BEFORE production_* batching: adding link must send one payload with
      // production_status + production_completion_date (see linkWithNeedReview). If this ran after
      // the batch block, a separate batched production_status-only update could race and confuse UI.

      const linkStr =
        field === 'google_drive_link' && value != null && value !== ''
          ? String(value).trim()
          : '';

      if (field === 'google_drive_link' && linkStr.length > 0) {
        const plan = contentPlans.find((p) => p.id === id);
        const patch = getGoogleDriveLinkNonEmptyUpdates(plan, linkStr, currentEmployeeId);
        if (Object.keys(patch).length === 0) {
          return;
        }
        const needsPicToast =
          patch.production_status === 'Need Review' &&
          !currentEmployeeId &&
          plan?.pic_production_source !== 'task_steps_assigned';
        updateContentPlan(id, patch);
        if (needsPicToast) {
          toast.warning(
            'Google Drive link saved, but could not auto-assign PIC Production (employee not found)'
          );
        }
        return;
      }

      if (field === 'google_drive_link' && (!value || String(value).trim().length === 0)) {
        const pending = pendingBatchUpdatesRef.current.get(id);
        if (pending?.updates?.production_status === 'Request Revision') {
          return;
        }
        const plan = contentPlans.find(p => p.id === id);

        if (plan?.pic_production_source === 'google_drive_link') {
          devLog.debug('🔗 Google Drive link cleared, syncing pic_production_id:', { planId: id });
          try {
            await syncPicProduction(id, null, plan.pic_production_id, plan.pic_production_source);
          } catch (error) {
            devLog.error('Error syncing pic_production_id:', error);
          }
          updateContentPlan(id, {
            google_drive_link: null,
            production_completion_date: null,
            production_status: null,
          });
        } else {
          devLog.debug('🔗 Google Drive link cleared, but PIC Production from assignment remains:', {
            planId: id,
            currentSource: plan?.pic_production_source,
          });
          updateContentPlan(id, {
            google_drive_link: null,
            production_completion_date: null,
            production_status: null,
          });
        }
        return;
      }

      // OPTIMIZED: Batch production_approved related fields to reduce database roundtrips
      // This prevents multiple trigger executions and improves performance
      if (
        field === 'production_approved' ||
        field === 'production_approved_date' ||
        field === 'production_status' ||
        field === 'production_completion_date' ||
        field === 'production_revision_count'
      ) {
        // Clear existing timeout for this plan
        const existing = pendingBatchUpdatesRef.current.get(id);
        if (existing) {
          clearTimeout(existing.timeout);
        }

        // Get or create pending updates
        const pending = pendingBatchUpdatesRef.current.get(id) || { updates: {}, timeout: null as any };
        pending.updates[field] = value;
        
        // IMPORTANT: If production_status is being set to "Request Revision", 
        // automatically include production_completion_date = null in the batch
        if (field === 'production_status' && value === 'Request Revision') {
          pending.updates['production_completion_date'] = null;
          pending.updates['production_approved'] = false;
          pending.updates['production_approved_date'] = null;
        }

        // Very short debounce (30ms) for immediate feel while still batching rapid changes
        // This ensures toggle feels instant but still batches multiple field updates
        const timeout = setTimeout(() => {
          const batch = pendingBatchUpdatesRef.current.get(id);
          if (batch && Object.keys(batch.updates).length > 0) {
            updateContentPlan(id, batch.updates);
            pendingBatchUpdatesRef.current.delete(id);
          }
        }, 30);

        pending.timeout = timeout;
        pendingBatchUpdatesRef.current.set(id, pending);
        return;
      }

      if (field === 'approved' && value === true) {
        // Toggle / flow approved tanpa modal (mis. shouldShowModal false karena post_date, atau status bukan Need Review):
        // jangan simpan hanya approved=true — selaraskan status + completion_date agar kolom Status tidak tertinggal "Need Review".
        const plan = contentPlans.find((p) => p.id === id);
        if (plan) {
          const completionDateToUse = plan.completion_date || new Date().toISOString();
          updateContentPlan(id, {
            approved: true,
            status: 'Approved',
            completion_date: completionDateToUse,
          });
        } else {
          updateContentPlan(id, { approved: true });
        }
      } else {
        // Regular field update
        updateContentPlan(id, { [field]: value });
      }
    } catch (error) {
      devLog.error('Error in handleFieldChange:', error);
      toast.error('Error updating field');
    }
  }, [updateContentPlan, currentEmployeeId, contentPlans, syncPicProduction, requestApproval]);

  const handleCarouselFirstUploadSuccess = useCallback(
    (planId: string) => {
      const plan = contentPlans.find((p) => p.id === planId);
      if (plan?.pic_production_source === 'task_steps_assigned') {
        devLog.debug('Carousel first upload: PIC Production already set from task_steps_assigned', { planId });
        return;
      }
      const employeeId = currentEmployeeId;
      if (!employeeId) {
        devLog.debug('Carousel first upload: cannot auto-assign PIC Production (employee not found)');
        return;
      }
      const completionDate = new Date().toISOString();
      devLog.debug('Carousel first upload: auto-populating PIC Production', { planId, employeeId });
      updateContentPlan(planId, {
        pic_production_id: employeeId,
        pic_production_source: 'google_drive_link',
        production_status: 'Need Review',
        production_completion_date: completionDate,
      });
    },
    [contentPlans, currentEmployeeId, updateContentPlan]
  );

  const handleCarouselAllRemoved = useCallback(
    async (planId: string) => {
      const plan = contentPlans.find((p) => p.id === planId);
      if (!plan) return;
      if (plan.pic_production_source === 'task_steps_assigned') {
        devLog.debug('Carousel all removed: PIC Production from task_steps_assigned, syncing only', { planId });
      }
      try {
        await syncPicProduction(planId, null, plan.pic_production_id, plan.pic_production_source);
        updateContentPlan(planId, {
          production_status: null,
          production_completion_date: null,
        });
      } catch (error) {
        devLog.error('Error resetting PIC Production after carousel all removed:', error);
      }
    },
    [contentPlans, syncPicProduction, updateContentPlan]
  );

  const handleAddContent = useCallback(async () => {
    if (!organizationId) {
      toast.error("Organization not found");
      return;
    }
    if (!currentEmployeeId) {
      toast.error("Current employee not found in organization");
      return;
    }

    try {
      const newContentData = {
        organization_id: organizationId,
        post_date: new Date().toISOString().split('T')[0],
        content_type_id: null,
        pic_id: currentEmployeeId,
        service_id: null,
        sub_service_id: null,
        title: null,
        content_pillar_id: null,
        brief: null,
        status: "",
        revision_count: 0,
        approved: false,
        completion_date: null,
        pic_production_id: null,
        google_drive_link: null,
        production_status: "",
        production_revision_count: 0,
        production_completion_date: null,
        production_approved: false,
        production_approved_date: null,
        post_link: null,
        done: false,
        actual_post_date: null,
        on_time_status: "",
        status_content: ""
      };
      await addContentPlan(newContentData);
      toast.success("Content added successfully");
    } catch (error) {
      devLog.error("Error adding new row:", error);
      toast.error("Error menambahkan baris baru: " + (error as Error).message);
    }
  }, [organizationId, currentEmployeeId, addContentPlan]);

  const handleMasterDataChange = useCallback(async () => {
    try {
      await refreshMasterData();
    } catch (error) {
      devLog.error('Error refreshing master data:', error);
      toast.error('Error refreshing data');
    }
  }, [refreshMasterData]);

  const handleEditTarget = useCallback((manager: any) => {
    setEditingManager(manager);
    if (activePerformanceTab === 'content-planner') {
      setTargetType('content_planning');
    } else if (activePerformanceTab === 'production') {
      setTargetType('content_production');
    } else if (activePerformanceTab === 'content-post') {
      setTargetType('content_posting');
    }
    setIsEditTargetOpen(true);
  }, [activePerformanceTab]);

  const handlePreviousMonth = useCallback(() => {
    const newDate = new Date(selectedMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    setSelectedMonth(newDate);
  }, [selectedMonth]);

  const handleNextMonth = useCallback(() => {
    const newDate = new Date(selectedMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    setSelectedMonth(newDate);
  }, [selectedMonth]);

  // Brief Dialog Handlers
  const openBriefDialog = useCallback((id: string, brief: string | null) => {
    setBriefDialog({
      isOpen: true,
      id,
      brief
    });
  }, []);

  const closeBriefDialog = useCallback(() => {
    setBriefDialog({
      isOpen: false,
      id: "",
      brief: null
    });
  }, []);

  /** Same approval entry as table toggle / status → Approved: open Select Daily Task when shouldShowModal applies */
  const tryStartApprovalFromBrief = useCallback(
    (planId: string): boolean => {
      const plan = contentPlans.find((p) => p.id === planId);
      if (!plan) return false;
      const oldStatus = plan.status || null;
      const oldApproved = plan.approved || false;
      const oldCompletionDate = plan.completion_date || null;
      const opened = requestApproval(plan, oldStatus, oldApproved, oldCompletionDate);
      if (opened) {
        pendingApprovalPlansRef.current.add(planId);
      }
      return opened;
    },
    [contentPlans, requestApproval],
  );

  const saveBrief = useCallback((brief: string, shouldUpdateStatus: boolean = false) => {
    if (!briefDialog.id) return;
    const trimmed = brief.trim();
    if (trimmed === '') {
      void updateContentPlan(briefDialog.id, {
        brief: trimmed,
        status: '',
        completion_date: null,
        approved: false,
      });
    } else {
      handleFieldChange(briefDialog.id, 'brief', trimmed);
      if (shouldUpdateStatus) {
        handleFieldChange(briefDialog.id, 'status', 'Need Review');
      }
    }
    closeBriefDialog();
  }, [briefDialog.id, handleFieldChange, closeBriefDialog, updateContentPlan]);

  // Title Dialog Handlers
  const openTitleDialog = useCallback((id: string, title: string | null, approved?: boolean) => {
    setTitleDialog({
      isOpen: true,
      id,
      title,
      approved
    });
  }, []);

  const closeTitleDialog = useCallback(() => {
    setTitleDialog({
      isOpen: false,
      id: "",
      title: null,
      approved: undefined
    });
  }, []);

  const saveTitle = useCallback((title: string) => {
    if (titleDialog.id) {
      handleFieldChange(titleDialog.id, 'title', title);
    }
  }, [titleDialog.id, handleFieldChange]);

  // Apply plan row updates from BriefDialog in one PATCH (brief save, approve, revision, etc.)
  const handleBriefStatusUpdate = useCallback(
    (planId: string, updates: Record<string, unknown>) => {
      // BriefDialog already persisted to Supabase; merge immediately so STATUS / revision_count
      // update without manual refresh. Realtime refetch is deferred while the modal is open.
      if (organizationId) {
        queryClient.setQueryData(
          ['social-media-plans', organizationId],
          (oldData: ContentPlan[] | undefined) => {
            if (!oldData) return oldData;
            return oldData.map((plan) =>
              plan.id === planId ? ({ ...plan, ...updates } as ContentPlan) : plan
            );
          }
        );
        queryClient.invalidateQueries({
          queryKey: ['social-media-plans', organizationId],
          refetchType: 'none',
        });
      }
      void updateContentPlan(planId, updates as Record<string, any>);
    },
    [updateContentPlan, organizationId, queryClient]
  );

  // Signal to realtime hook: skip social_media_plans refetch while Brief modal is open
  useEffect(() => {
    setBriefModalOpenPlanId(briefDialog.isOpen && briefDialog.id ? briefDialog.id : null);
    return () => setBriefModalOpenPlanId(null);
  }, [briefDialog.isOpen, briefDialog.id]);

  return (
        <SocialMediaErrorBoundary>
          <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-gray-100 font-sans">
          {dataError && (
            <div className="flex-shrink-0 px-4 py-2 bg-red-50 border-b border-red-200 flex items-center justify-between gap-2">
              <span className="text-sm text-red-800">Failed to load dashboard data. Please try again.</span>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await refreshAll();
                  } catch (e) {
                    toast.error('Retry failed. Try again.');
                  }
                }}
                className="text-sm font-medium text-red-700 hover:text-red-900 underline"
              >
                Retry
              </button>
            </div>
          )}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col px-4 pb-2">
              <div className="flex h-full min-h-0 flex-col">
                <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="relative flex min-h-full flex-1 flex-col">
                    <div
                      className={
                        showDashboardSkeleton
                          ? 'invisible pointer-events-none flex min-h-full min-h-0 flex-1 flex-col'
                          : 'flex min-h-full min-h-0 flex-1 flex-col'
                      }
                      aria-hidden={showDashboardSkeleton}
                    >
                      <div className="mb-1 flex-shrink-0">
                        <HeaderAndTab
                          activeMainTab={activeMainTab}
                          handleTabChange={handleTabChange}
                        />
                      </div>

                      <PageAccessContentGate
                        pagePath={location.pathname}
                        className="mt-0 flex min-h-0 min-w-0 flex-1 flex-col"
                      >
                      <Tabs value={activeMainTab} onValueChange={handleTabChange} className="mt-0 flex min-h-0 flex-1 flex-col">
                        <TabsContent
                          value="dashboard"
                          className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
                        >
                          <div className="flex min-h-0 flex-1 flex-col">
                            <div className="mb-2 flex-shrink-0">
                              <SocialMediaErrorBoundary>
                                <SocialMediaPerformanceTabs
                                activePerformanceTab={activePerformanceTab}
                                setActivePerformanceTab={setActivePerformanceTab}
                                selectedDate={selectedDate}
                                setSelectedDate={setSelectedDate}
                                selectedMonth={selectedMonth}
                                setSelectedMonth={setSelectedMonth}
                                isCalendarOpen={isCalendarOpen}
                                setIsCalendarOpen={setIsCalendarOpen}
                                isMonthSelectorOpen={isMonthSelectorOpen}
                                setIsMonthSelectorOpen={setIsMonthSelectorOpen}
                                contentPlanners={contentPlanners || []}
                                creativeProductionMembers={creativeProductionMembers || []}
                                digitalEmployees={digitalEmployees}
                                handleEditTarget={handleEditTarget}
                                handlePreviousMonth={handlePreviousMonth}
                                handleNextMonth={handleNextMonth}
                              />
                            </SocialMediaErrorBoundary>
                          </div>

                          <div className="grid min-h-[calc(100vh-120px)] max-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 overflow-hidden [grid-template-rows:minmax(0,1fr)] items-stretch">
                            <div className="col-span-9 flex min-h-0 flex-col space-y-2 overflow-hidden">
                              <div className="flex-shrink-0">
                                <SocialMediaErrorBoundary>
                                  <SocialMediaMetrics metrics={metrics} isLoading={false} />
                                </SocialMediaErrorBoundary>
                              </div>

                              <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                                <div className="flex-shrink-0 border-b-2 border-gray-300 bg-white p-4 pb-3">
                                  <SocialMediaErrorBoundary>
                                    <SocialMediaFilters
                                      searchTerm={searchTerm}
                                      setSearchTerm={setSearchTerm}
                                      statusFilter={statusFilter}
                                      setStatusFilter={setStatusFilter}
                                      serviceFilter={serviceFilter}
                                      setServiceFilter={setServiceFilter}
                                      services={services}
                                      selectedItems={selectedItems}
                                      onAddContent={handleAddContent}
                                      onDeleteSelected={handleDeleteSelected}
                                      selectedMonth={selectedMonth}
                                      setSelectedMonth={setSelectedMonth}
                                      onNotificationPreviewRequest={(planId) => setNotificationPreviewPlanId(planId)}
                                    />
                                  </SocialMediaErrorBoundary>
                                </div>

                                <div
                                  className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 max-h-[calc(100vh-320px)] flex-1 overflow-y-auto overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                                >
                                  <SocialMediaErrorBoundary>
                                    {!showDashboardSkeleton ? (
                                    <ContentPlanTable
                                      contentPlans={Array.isArray(filteredContentPlans) ? filteredContentPlans : []}
                                      contentTypes={Array.isArray(contentTypes) ? contentTypes : []}
                                      services={Array.isArray(services) ? services : []}
                                      subServices={Array.isArray(subServices) ? subServices : []}
                                      contentPillars={Array.isArray(contentPillars) ? contentPillars : []}
                                      linksByPlanId={linksByPlanId}
                                      scheduleByPlanId={scheduleByPlanId}
                                      digitalEmployees={digitalEmployees}
                                      creativeEmployees={digitalEmployees}
                                      currentUserRole={currentUserRole ?? null}
                                      onSelectItem={handleSelectItem}
                                      selectedItems={selectedItems}
                                      onFieldChange={handleFieldChange}
                                      onOpenBriefDialog={openBriefDialog}
                                      onOpenTitleDialog={openTitleDialog}
                                      onContentTypeDataChange={handleMasterDataChange}
                                      onServiceDataChange={handleMasterDataChange}
                                      onContentPillarDataChange={handleMasterDataChange}
                                      loading={false}
                                      approvalAccess={approvalAccess}
                                      hasActiveFilters={statusFilter !== 'all' || serviceFilter !== 'all'}
                                      requestApproval={requestApproval}
                                      handleUnapproval={handleUnapproval}
                                      onCarouselFirstUploadSuccess={handleCarouselFirstUploadSuccess}
                                      onCarouselAllRemoved={handleCarouselAllRemoved}
                                      onProductionResubmitForReview={handleProductionResubmitForReview}
                                    />
                                    ) : (
                                      <div className="flex min-h-[200px] items-center justify-center py-8" aria-hidden />
                                    )}
                                  </SocialMediaErrorBoundary>
                                </div>

                                <div className="flex-shrink-0 border-t border-gray-200 bg-white">
                                  {!showDashboardSkeleton ? (
                                  <TableFooter
                                    onContentTypeDataChange={handleMasterDataChange}
                                    onServiceDataChange={handleMasterDataChange}
                                    onContentPillarDataChange={handleMasterDataChange}
                                    onSocialMediaNameDataChange={() => {}}
                                    services={Array.isArray(services) ? services : []}
                                  />
                                  ) : (
                                    <div className="h-8" aria-hidden />
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="col-span-3 flex min-h-0 flex-col overflow-hidden">
                              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                                <SidebarContainer selectedMonth={deferredMonth} serviceFilter={serviceFilter} />
                              </div>
                            </div>
                          </div>
                          </div>
                        </TabsContent>
                      </Tabs>
                      </PageAccessContentGate>
                    </div>

                    {showDashboardSkeleton && (
                      <div
                        className="absolute inset-0 z-20 flex min-h-0 flex-col overflow-hidden bg-gray-100"
                        aria-busy
                        aria-label="Memuat dashboard social media"
                      >
                        <span className="sr-only">Memuat dashboard social media</span>
                        <SocialMediaDashboardSkeleton mode="overlay" headerActiveTabId={activeMainTab} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Dialogs */}
          <BriefDialog 
            isOpen={briefDialog.isOpen} 
            onClose={closeBriefDialog} 
            brief={briefDialog.brief || ""} 
            onSave={saveBrief}
            socialMediaPlanId={briefDialog.id}
            onStatusUpdate={handleBriefStatusUpdate}
            contentPlans={contentPlans}
            tryStartApprovalFromBrief={tryStartApprovalFromBrief}
          />

          <TitleDialog 
            isOpen={titleDialog.isOpen} 
            onClose={closeTitleDialog} 
            title={titleDialog.title || ""} 
            onSave={saveTitle}
            socialMediaPlanId={titleDialog.id}
            approved={titleDialog.id ? contentPlans.find(p => p.id === titleDialog.id)?.approved : undefined}
          />

          <EditTargetDialog 
            isOpen={isEditTargetOpen} 
            onClose={() => setIsEditTargetOpen(false)}
            employeeId={editingManager?.id}
            employeeName={editingManager?.name}
            targetType={targetType}
          />

          {/* Preview modal when user clicks a comment notification (opens here instead of public page) */}
          {notificationPreviewPlan && (
            <GoogleDriveLinkDialog
              isOpen={true}
              onClose={() => setNotificationPreviewPlanId(null)}
              googleDriveLink={notificationPreviewPlan.google_drive_link || ''}
              productionApproved={notificationPreviewPlan.production_approved || false}
              productionStatus={notificationPreviewPlan.production_status ?? undefined}
              onSave={(link) => {
                const normalized = link?.trim() ? link : null;
                handleFieldChange(notificationPreviewPlan.id, 'google_drive_link', normalized);
                if (!normalized) handleFieldChange(notificationPreviewPlan.id, 'production_status', null);
              }}
              socialMediaPlanId={notificationPreviewPlan.id}
              planTitle={notificationPreviewPlan.title ?? undefined}
              contentTitle={notificationPreviewPlan.title ?? undefined}
              contentType={notificationPreviewPlan.content_type?.name}
              postDate={notificationPreviewPlan.post_date ?? undefined}
              serviceName={notificationPreviewPlan.service?.name ?? null}
              picProductionName={notificationPreviewPlan.pic_production?.full_name ?? null}
              onApprove={() => {
                handleFieldChange(notificationPreviewPlan.id, 'production_approved', true);
                handleFieldChange(notificationPreviewPlan.id, 'production_approved_date', new Date().toISOString());
                handleFieldChange(notificationPreviewPlan.id, 'production_status', 'Approved');
              }}
              onCarouselChange={() => {
                queryClient.invalidateQueries({ queryKey: ['social-media-carousel'] });
                queryClient.invalidateQueries({ queryKey: ['social-media-plans'] });
              }}
              onCarouselFirstUploadSuccess={handleCarouselFirstUploadSuccess}
              onCarouselAllRemoved={handleCarouselAllRemoved}
              revisionBaselineLink={notificationPreviewPlan.production_revision_baseline_link ?? null}
              onResubmitForReview={() =>
                handleProductionResubmitForReview(notificationPreviewPlan.id)
              }
            />
          )}

          {/* Daily Task Selector Dialog for Approval */}
          {pendingApproval && (
            <DailyTaskSelectorDialog
              isOpen={isTaskSelectorOpen}
              onClose={handleModalClose}
              onSelect={handleTaskSelected}
              dueDate={pendingApproval.plan.post_date || null}
              serviceName={pendingApproval.plan.service?.name || (services?.find?.((s: any) => s.id === pendingApproval.plan.service_id)?.name) || ''}
              organizationIdOverride={pendingApproval.plan.organization_id}
              skipAssignment={true} // Skip assignment modal karena task step auto-completed
            />
          )}
        </div>
        </SocialMediaErrorBoundary>
  );
}

// Main export with providers: one prefetch then smooth render
export default function SocialMediaDashboardPage() {
  return (
    <OptimizedErrorBoundary>
      <DashboardDataPreloader>
        <RealtimeSocialMediaProvider>
          <PICFilterProvider>
            <SocialMediaContent />
          </PICFilterProvider>
        </RealtimeSocialMediaProvider>
      </DashboardDataPreloader>
    </OptimizedErrorBoundary>
  );
}
