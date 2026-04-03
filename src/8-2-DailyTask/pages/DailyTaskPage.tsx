import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TaskFilters } from '../section/TaskFilters';
import { TaskList } from '../section/TaskList';
import TaskSummaryCards from '../section/TaskSummaryCards';
import TaskInitiative, { InitiativeStats } from '../section/TaskInitiative';
import { TaskListFooter } from '../section/TaskListFooter';
import { TaskSidebarFooter } from '../section/TaskSidebarFooter';
import { TaskInitiativeFooter } from '../section/TaskInitiativeFooter';
import { CreateDailyTemplateModal } from '../section/CreateDailyTemplateModal';
import { DailyTaskProvider, useDailyTask } from '../context/DailyTaskContext';
import { ApplyPendingApprovalFocusFromState } from '../components/ApplyPendingApprovalFocusFromState';
import { MeetingNotesProvider } from '@/8-1-meeting-notes/context/MeetingNotesContext';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { JobDescTracker, type JobDescTrackerStats } from '../section/JobDescTracker';
import { JobDescSidebarFooter } from '../section/JobDescSidebarFooter';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useDebouncedReady } from '@/shared/hooks/useDebouncedReady';
import { supabase } from '@/shared/lib/supabaseClient';
import type { ContentPlan } from '@/features/6-1-dashboard/types/social-media';
import GoogleDriveLinkDialog from '@/features/6-1-dashboard/modal/GoogleDriveLinkDialog';
import { Dialog, DialogContent } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { DailyTaskModuleShell } from '../layout/DailyTaskModuleShell';

const DailyTaskPage = () => {
  return (
    <MeetingNotesProvider>
      <DailyTaskProvider>
        <ApplyPendingApprovalFocusFromState />
        <DailyTaskContent />
      </DailyTaskProvider>
    </MeetingNotesProvider>
  );
};

const DailyTaskContent = () => {
  const { t } = useAppTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { organizationId, loading: organizationLoading } = useCurrentOrg();
  const queryClient = useQueryClient();
  const { tasks, filteredTasks, isLoading, setFilters, setExpandedTasks, setHighlightedTask, scrollToStep } = useDailyTask();
  const [sidebarTab, setSidebarTab] = useState<'summary' | 'initiative' | 'jobdesc'>('summary');
  const [initiativeStats, setInitiativeStats] = useState<InitiativeStats>({ totalItems: 0, unassignedItems: 0 });
  const [jobDescStats, setJobDescStats] = useState<JobDescTrackerStats>({
    assignments: 0,
    busy: 0,
    idle: 0,
    pendingDays: 0,
  });
  const [createTemplateSheetOpen, setCreateTemplateSheetOpen] = useState(false);
  const appliedNavParamsRef = useRef(false);

  // Preview modal from "View Content" in Task Summary Pending Approval (same as Comment Notifications on dashboard)
  const [previewPlanIdForModal, setPreviewPlanIdForModal] = useState<string | null>(null);
  const pendingApprovalRefreshRef = useRef<(() => void) | null>(null);

  const PLAN_SELECT = `
    id, organization_id, post_date, content_type_id, pic_id, service_id, sub_service_id, title, content_pillar_id, brief, status, revision_count, approved, completion_date, pic_production_id, pic_production_source, google_drive_link, production_status, production_revision_count, production_completion_date, production_approved, production_approved_date, post_link, post_link_created_by, done, actual_post_date, on_time_status, status_content, created_at, updated_at,
    content_type:content_types(id, name), service:services(id, name), sub_service:sub_services(id, name), content_pillar:content_pillars(id, name, color), pic:employees!social_media_plans_pic_id_fkey(id, full_name), pic_production:employees!social_media_plans_pic_production_id_fkey(id, full_name), post_link_creator:employees!social_media_plans_post_link_created_by_fkey(id, full_name)
  `;
  const { data: previewPlanFetched, isFetching, isError } = useQuery({
    queryKey: ['social-media-plan', previewPlanIdForModal],
    enabled: !!previewPlanIdForModal && !!organizationId,
    queryFn: async (): Promise<ContentPlan | null> => {
      if (!previewPlanIdForModal || !organizationId) return null;
      const { data, error } = await supabase
        .from('social_media_plans')
        .select(PLAN_SELECT)
        .eq('id', previewPlanIdForModal)
        .eq('organization_id', organizationId)
        .single();
      if (error || !data) return null;
      return data as unknown as ContentPlan;
    },
    staleTime: 10000,
  });

  const previewPlan: ContentPlan | null = previewPlanIdForModal ? previewPlanFetched ?? null : null;

  useEffect(() => {
    if (!previewPlanIdForModal) return;
    queryClient.invalidateQueries({ queryKey: ['link-comments', previewPlanIdForModal] });
  }, [previewPlanIdForModal, queryClient]);

  const handleClosePreviewModal = () => {
    setPreviewPlanIdForModal(null);
    pendingApprovalRefreshRef.current?.();
    pendingApprovalRefreshRef.current = null;
  };

  // Apply URL params from Home (standalone SectionActivityNotifikasi) after tasks are loaded
  useEffect(() => {
    if (isLoading || tasks.length === 0 || appliedNavParamsRef.current) return;
    const taskId = searchParams.get('taskId');
    const stepId = searchParams.get('stepId');
    const search = searchParams.get('search');
    const action = searchParams.get('action');
    if (!taskId) return;

    appliedNavParamsRef.current = true;
    if (search) setFilters(prev => ({ ...prev, search }));
    setExpandedTasks(prev => new Set([...prev, taskId]));
    setHighlightedTask(taskId);
    setTimeout(() => setHighlightedTask(null), 3000);
    if (action === 'scroll' && stepId) {
      setTimeout(() => scrollToStep(stepId), 400);
    }
    setSearchParams({}, { replace: true });
  }, [isLoading, tasks.length, searchParams, setFilters, setExpandedTasks, setHighlightedTask, scrollToStep, setSearchParams]);

  const showContent = useDebouncedReady(
    !organizationLoading && (!organizationId || !isLoading),
    200,
  );

  // Statistics from filtered tasks so sidebar responds to filters
  const thisWeekTasks = filteredTasks.filter(task => {
    const taskDate = new Date(task.created_at);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return taskDate >= weekAgo;
  }).length;

  const completedTasks = filteredTasks.filter(task => task.status === 'completed').length;
  const completionRate = filteredTasks.length > 0 ? Math.round((completedTasks / filteredTasks.length) * 100) : 0;

  return (
    <>
      <DailyTaskModuleShell activeTab="daily-task" onTabChange={() => {}} showContent={showContent}>
        <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
          {/* Main Content - 9 columns */}
          <div className="col-span-9 flex min-h-0 min-w-0 flex-col gap-1">
            <div className="flex-shrink-0">
              <div className="rounded-md border border-border bg-card p-2">
              <TaskFilters />
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <div className="h-full bg-white rounded-lg border border-brand-blue/20 shadow-sm ring-1 ring-brand-blue/10 flex flex-col">
                <div className="flex-1 min-h-0 p-4">
                  <TaskList />
                </div>

                <TaskListFooter
                  totalTasks={tasks.length}
                  filteredTasks={filteredTasks.length}
                  onOpenCreateTemplate={() => setCreateTemplateSheetOpen(true)}
                />
              </div>
            </div>
          </div>

          {/* Sidebar - 3 columns */}
          <div className="col-span-3 flex h-full min-h-0 min-w-0 flex-col">
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-brand-blue/20 bg-white shadow-sm ring-1 ring-brand-blue/10">
              {/* Sidebar tabs — single border row, clipped to card radius */}
              <div className="flex min-w-0 shrink-0 border-b border-gray-200 bg-brand-blue/5">
                <button
                  type="button"
                  onClick={() => setSidebarTab('summary')}
                  className={`min-w-0 flex-1 truncate px-2 py-2.5 text-center text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
                    sidebarTab === 'summary'
                      ? 'border-b-2 border-brand-blue bg-brand-blue/10 text-brand-blue'
                      : 'border-b-2 border-transparent text-gray-600 hover:bg-gray-50/90 hover:text-gray-900'
                  }`}
                >
                  {t('dailyTask.sidebar.summaryTab', 'Task Summary')}
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarTab('initiative')}
                  className={`min-w-0 flex-1 truncate px-2 py-2.5 text-center text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
                    sidebarTab === 'initiative'
                      ? 'border-b-2 border-brand-blue bg-brand-blue/10 text-brand-blue'
                      : 'border-b-2 border-transparent text-gray-600 hover:bg-gray-50/90 hover:text-gray-900'
                  }`}
                >
                  {t('dailyTask.sidebar.initiativeTab', 'Initiative')}
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarTab('jobdesc')}
                  className={`min-w-0 flex-1 truncate px-2 py-2.5 text-center text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
                    sidebarTab === 'jobdesc'
                      ? 'border-b-2 border-brand-blue bg-brand-blue/10 text-brand-blue'
                      : 'border-b-2 border-transparent text-gray-600 hover:bg-gray-50/90 hover:text-gray-900'
                  }`}
                >
                  {t('dailyTask.sidebar.jobDescTab', 'Job Desc')}
                </button>
              </div>

              {/* Scrollable Sidebar Content */}
              <div className="flex min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-gradient-to-b from-brand-blue/[0.04] to-transparent px-4 py-4 [scrollbar-gutter:stable] seamless-scroll nested-scroll-touch-chain">
                {sidebarTab === 'summary' && (
                  <TaskSummaryCards
                    onOpenPreview={(planId, callbacks) => {
                      setPreviewPlanIdForModal(planId);
                      pendingApprovalRefreshRef.current = callbacks?.onClose ?? null;
                    }}
                  />
                )}
                {sidebarTab === 'initiative' && <TaskInitiative onStatsChange={setInitiativeStats} />}
                {sidebarTab === 'jobdesc' && <JobDescTracker onStatsChange={setJobDescStats} />}
              </div>

              {/* Sidebar Footer - Conditional based on active tab */}
              {sidebarTab === 'summary' && (
                <TaskSidebarFooter
                  totalTasks={filteredTasks.length}
                  thisWeek={thisWeekTasks}
                  completionRate={completionRate}
                />
              )}
              {sidebarTab === 'initiative' && (
                <TaskInitiativeFooter
                  totalItems={initiativeStats.totalItems}
                  unassignedItems={initiativeStats.unassignedItems}
                />
              )}
              {sidebarTab === 'jobdesc' && (
                <JobDescSidebarFooter
                  assignments={jobDescStats.assignments}
                  busy={jobDescStats.busy}
                  idle={jobDescStats.idle}
                  pendingDays={jobDescStats.pendingDays}
                />
              )}
            </div>
          </div>
        </div>
      </DailyTaskModuleShell>

      <CreateDailyTemplateModal
        open={createTemplateSheetOpen}
        onOpenChange={setCreateTemplateSheetOpen}
        onSuccess={() => setCreateTemplateSheetOpen(false)}
      />

      {/* Preview modal when "View Content" is clicked in Task Summary Pending Approval */}
      {previewPlanIdForModal && !previewPlan && (
        <Dialog open={true} onOpenChange={open => !open && handleClosePreviewModal()}>
          <DialogContent className="max-w-md">
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              {isError ? (
                <p className="text-sm text-brand-red">Failed to load content. You may not have access.</p>
              ) : (
                <div className="flex w-full flex-col items-center gap-3" aria-busy aria-label="Loading preview">
                  <Skeleton className="h-24 w-full rounded-lg" />
                  <Skeleton className="h-4 w-48" />
                  <span className="sr-only">Loading preview...</span>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={handleClosePreviewModal}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {previewPlan && (
        <GoogleDriveLinkDialog
          isOpen={true}
          onClose={handleClosePreviewModal}
          googleDriveLink={previewPlan.google_drive_link || ''}
          productionApproved={previewPlan.production_approved || false}
          onSave={link => {
            const normalized = link?.trim() ? link : null;
            supabase
              .from('social_media_plans')
              .update({
                google_drive_link: normalized,
                ...(normalized ? {} : { production_status: null }),
                updated_at: new Date().toISOString(),
              })
              .eq('id', previewPlan.id)
              .then(() => {});
          }}
          socialMediaPlanId={previewPlan.id}
          planTitle={previewPlan.title ?? undefined}
          contentTitle={previewPlan.title ?? undefined}
          contentType={previewPlan.content_type?.name}
          postDate={previewPlan.post_date ?? undefined}
          serviceName={previewPlan.service?.name ?? null}
          picProductionName={previewPlan.pic_production?.full_name ?? null}
          onCarouselChange={() => {
            queryClient.invalidateQueries({ queryKey: ['social-media-plan', previewPlan.id] });
            queryClient.invalidateQueries({ queryKey: ['social-media-carousel', previewPlan.id] });
            pendingApprovalRefreshRef.current?.();
          }}
          onApprove={() => {
            pendingApprovalRefreshRef.current?.();
          }}
          onRevision={() => {
            pendingApprovalRefreshRef.current?.();
          }}
        />
      )}
    </>
  );
};

export default DailyTaskPage;

