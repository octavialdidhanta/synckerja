import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, User, Loader2, ClipboardCheck, Eye } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { useCompletionApprovals } from '../hooks/useCompletionApprovals';
import { useDailyTask } from '../context/DailyTaskContext';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useToast } from '@/shared/components/ui/use-toast';
import type { CompletionApprovalRow } from '../services/completionApprovalService';
import { supabase } from '@/shared/lib/supabaseClient';
import { usePublicReviewToken } from '@/6-1-dashboard/hook/usePublicReviewToken';
import { useIsMobile } from '@/mobile/shared/hooks/use-mobile';

function getDisplayTitle(row: CompletionApprovalRow): string {
  const taskTitle = row.daily_tasks?.title ?? 'Task';
  if (row.entity_type === 'task') return taskTitle;
  const stepTitle = row.task_steps?.title ?? 'Step';
  if (row.entity_type === 'step') return `${taskTitle} → ${stepTitle}`;
  const subTitle = row.task_steps_to_steps?.title ?? 'Sub-step';
  return `${taskTitle} → ${stepTitle} → ${subTitle}`;
}

function getEntityTypeLabel(entityType: string, t: (k: string, fallback: string) => string): string {
  if (entityType === 'task') return t('dailyTask.approval.entityTask', 'Task');
  if (entityType === 'step') return t('dailyTask.approval.entityStep', 'Step');
  return t('dailyTask.approval.entitySubstep', 'Sub-step');
}

export interface PendingApprovalSectionProps {
  /** When 'jobdesc-overview', title click navigates to Daily Task Summary view instead of task list. */
  variant?: 'sidebar' | 'jobdesc-overview';
  /** When provided, "View Content" opens the preview modal instead of navigating to /review (Task Summary only). */
  onOpenPreview?: (planId: string, callbacks?: { onClose: () => void }) => void;
}

export const PendingApprovalSection = ({ variant, onOpenPreview }: PendingApprovalSectionProps = {}) => {
  const { t } = useAppTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { getOrCreate } = usePublicReviewToken();
  const { pending, rejected, loading, fetchError, approve, reject, refresh } = useCompletionApprovals([]);
  const { refetchTasks, uncheckCompletionLocally, applyApprovalDecisionLocally, setPendingApprovalFocus, navigateToTask } = useDailyTask();
  const { toast } = useToast();
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; row: CompletionApprovalRow | null; reason: string }>({
    open: false,
    row: null,
    reason: '',
  });
  /** Row for which approve confirmation is shown (simple popup to avoid accidental click). */
  const [approveConfirmRow, setApproveConfirmRow] = useState<CompletionApprovalRow | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  /** Row id for which "View Content" is in progress (navigate to /review/{token}). */
  const [viewContentLoadingRowId, setViewContentLoadingRowId] = useState<string | null>(null);
  const [refetchError, setRefetchError] = useState<string | null>(null);

  const handleApprove = async (row: CompletionApprovalRow) => {
    setActingId(row.id);
    const { error } = await approve(row.id);
    setActingId(null);
    if (error) {
      toast({ title: t('dailyTask.approval.error', 'Error'), description: error.message, variant: 'destructive' });
      return;
    }
    // Optimistic local sync so step/task state reacts immediately on both desktop and mobile views.
    applyApprovalDecisionLocally({
      entityType: row.entity_type,
      dailyTaskId: row.daily_task_id,
      decision: 'approve',
      taskStepId: row.task_step_id ?? undefined,
      taskStepsToStepsId: row.task_steps_to_steps_id ?? undefined,
    });
    toast({ title: t('dailyTask.approval.approved', 'Approved'), description: t('dailyTask.approval.approvedDesc', 'Completion approved.') });
    refresh();
    try {
      setRefetchError(null);
      await refetchTasks();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('dailyTask.approval.refetchFailed', 'Failed to refresh tasks');
      setRefetchError(msg);
    }
  };

  const handleApproveClick = (row: CompletionApprovalRow) => {
    setApproveConfirmRow(row);
  };

  const handleApproveConfirm = async () => {
    if (!approveConfirmRow) return;
    const row = approveConfirmRow;
    setApproveConfirmRow(null);
    await handleApprove(row);
  };

  const handleRejectClick = (row: CompletionApprovalRow) => {
    setRejectDialog({ open: true, row, reason: '' });
  };

  const handleRejectSubmit = async () => {
    if (!rejectDialog.row || !rejectDialog.reason.trim()) {
      toast({
        title: t('dailyTask.approval.reasonRequired', 'Reason required'),
        description: t('dailyTask.approval.reasonRequiredDesc', 'Please enter a reason for rejection.'),
        variant: 'destructive',
      });
      return;
    }
    const row = rejectDialog.row;
    const reason = rejectDialog.reason.trim();
    setActingId(row.id);
    const { error } = await reject(row.id, reason);
    setActingId(null);
    setRejectDialog({ open: false, row: null, reason: '' });
    if (error) {
      toast({ title: t('dailyTask.approval.error', 'Error'), description: error.message, variant: 'destructive' });
      return;
    }
    // Optimistic update: uncheck item in main table immediately so user sees change without manual refresh
    uncheckCompletionLocally({
      entityType: row.entity_type,
      dailyTaskId: row.daily_task_id,
      taskStepId: row.task_step_id ?? undefined,
      taskStepsToStepsId: row.task_steps_to_steps_id ?? undefined,
    });
    applyApprovalDecisionLocally({
      entityType: row.entity_type,
      dailyTaskId: row.daily_task_id,
      decision: 'reject',
      taskStepId: row.task_step_id ?? undefined,
      taskStepsToStepsId: row.task_steps_to_steps_id ?? undefined,
    });
    toast({ title: t('dailyTask.approval.rejected', 'Rejected'), description: t('dailyTask.approval.rejectedDesc', 'Completion rejected; item unchecked.') });
    refresh();
    try {
      setRefetchError(null);
      await refetchTasks();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('dailyTask.approval.refetchFailed', 'Failed to refresh tasks');
      setRefetchError(msg);
      toast({ title: t('dailyTask.approval.error', 'Error'), description: msg, variant: 'destructive' });
    }
  };

  const handleTitleClick = (row: CompletionApprovalRow) => {
    const taskId = row.daily_task_id;
    const stepId = row.task_step_id ?? undefined;
    if (variant === 'jobdesc-overview') {
      setPendingApprovalFocus(
        row.entity_type === 'task'
          ? { taskId }
          : row.entity_type === 'step'
            ? { taskId, stepId }
            : { taskId, stepId, openSubStepModalForStepId: stepId },
      );
      navigate('/tools/daily-task?view=summary');
      return;
    }
    if (row.entity_type === 'task') {
      setPendingApprovalFocus({ taskId });
      navigateToTask(taskId);
    } else if (row.entity_type === 'step') {
      setPendingApprovalFocus({ taskId, stepId });
      navigateToTask(taskId, stepId);
    } else {
      setPendingApprovalFocus({ taskId, stepId, openSubStepModalForStepId: stepId });
      navigateToTask(taskId, stepId);
    }
  };

  const handleViewContent = async (row: CompletionApprovalRow) => {
    const planId = row.entity_type === 'step' ? row.task_steps?.social_media_plan_id : null;
    if (!planId) return;

    // Mobile: always navigate to /review (same experience as guest/public review link; desktop uses modal)
    const useModal = !isMobile && onOpenPreview && variant !== 'jobdesc-overview';
    if (useModal) {
      onOpenPreview(planId, { onClose: refresh });
      return;
    }

    // Navigate to /review page (mobile, or desktop Job Desc, or when no modal handler)
    setViewContentLoadingRowId(row.id);
    try {
      // Use maybeSingle() to avoid 406 when RLS returns 0 rows (single() expects exactly one row)
      const { data, error } = await supabase
        .from('social_media_plans')
        .select('google_drive_link')
        .eq('id', planId)
        .maybeSingle();
      if (error) throw error;
      const linkUrl = (data as { google_drive_link?: string | null } | null)?.google_drive_link?.trim();
      if (!linkUrl) {
        toast({
          title: t('dailyTask.approval.error', 'Error'),
          description: t('dailyTask.approval.noContentLink', 'No content link for this plan.'),
          variant: 'destructive',
        });
        return;
      }
      const { token } = await getOrCreate({ socialMediaPlanId: planId, linkUrl });
      navigate(`/review/${token}`, { state: { from: 'jobdesc' } });
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : (e as { code?: string; message?: string })?.code === 'PGRST116'
            ? t('dailyTask.approval.reviewAccessDenied', 'Content not found or access denied.')
            : t('dailyTask.approval.reviewOpenFailed', 'Failed to open review.');
      toast({
        title: t('dailyTask.approval.error', 'Error'),
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setViewContentLoadingRowId(null);
    }
  };

  const showViewContent = (row: CompletionApprovalRow) =>
    row.entity_type === 'step' && !!row.task_steps?.social_media_plan_id;

  return (
    <>
      {/* Pending Approval card (same style as Task Summary cards) */}
      <div className="mt-4 min-w-0">
        <div
          className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between min-h-[60px] min-w-0"
        >
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-gray-700">
              {t('dailyTask.approval.pendingTitle', 'Pending your approval')}
            </span>
          </div>
          <span className="text-xl font-bold text-amber-600">{pending.length}</span>
        </div>

        {/* List of items to approve (seamless vertical scroll; per .cursor/rules/scroll-chaining.mdc: chain on all views including jobdesc) */}
        <div className="mt-2 max-h-[min(40vh,320px)] overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain min-h-0 min-w-0">
          {fetchError ? (
            <p className="text-xs text-red-600 py-2">
              {t('dailyTask.approval.fetchError', 'Failed to load approvals. Please try again.')}
              <button type="button" onClick={() => refresh()} className="ml-2 underline font-medium">
                {t('dailyTask.approval.retry', 'Retry')}
              </button>
            </p>
          ) : refetchError ? (
            <p className="text-xs text-red-600 py-2">
              {refetchError}
              <button
                type="button"
                onClick={async () => {
                  try {
                    setRefetchError(null);
                    await refetchTasks();
                  } catch (e) {
                    setRefetchError(e instanceof Error ? e.message : t('dailyTask.approval.refetchFailed', 'Failed to refresh tasks'));
                  }
                }}
                className="ml-2 underline font-medium"
              >
                {t('dailyTask.approval.retry', 'Retry')}
              </button>
            </p>
          ) : loading && pending.length === 0 ? (
            <p className="text-xs text-gray-500 py-2 flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0" />
              {t('dailyTask.approval.loading', 'Loading...')}
            </p>
          ) : pending.length === 0 ? (
            <p className="text-xs text-gray-500 py-2">{t('dailyTask.approval.noPending', 'No items pending approval.')}</p>
          ) : (
            <ul className="space-y-2">
              {pending.map((row) => (
                <li
                  key={row.id}
                  className="border border-gray-200 rounded-lg p-3 bg-white text-sm overflow-hidden min-w-0"
                >
                  <button
                    type="button"
                    onClick={() => handleTitleClick(row)}
                    className="w-full text-left font-medium text-gray-900 truncate cursor-pointer hover:text-amber-700 hover:underline focus:outline-none focus:ring-1 focus:ring-amber-400 rounded"
                    title={getDisplayTitle(row)}
                  >
                    {getDisplayTitle(row)}
                  </button>
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                    <User className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{row.assignee?.full_name ?? t('dailyTask.approval.assignee', 'Assignee')}</span>
                    <span className="text-gray-400 flex-shrink-0">·</span>
                    <span className="flex-shrink-0">{getEntityTypeLabel(row.entity_type, t)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {showViewContent(row) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-gray-700 border-gray-200 hover:bg-gray-50 h-7 px-2 text-xs"
                        onClick={() => handleViewContent(row)}
                        disabled={viewContentLoadingRowId !== null}
                      >
                        {viewContentLoadingRowId === row.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        ) : (
                          <Eye className="h-3.5 w-3.5 mr-1" />
                        )}
                        {t('dailyTask.approval.viewContent', 'View Content')}
                      </Button>
                    )}
                    {/* When card has "View Content", Approve/Reject are in the Preview modal (or /review for jobdesc) — hide on card */}
                    {!showViewContent(row) && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 border-green-200 hover:bg-green-50 h-7 px-2 text-xs"
                          onClick={() => handleApproveClick(row)}
                          disabled={actingId === row.id}
                        >
                          {actingId === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5 mr-1" />}
                          {t('dailyTask.approval.approve', 'Approve')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50 h-7 px-2 text-xs"
                          onClick={() => handleRejectClick(row)}
                          disabled={actingId === row.id}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          {t('dailyTask.approval.reject', 'Reject')}
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Rejected by assigner (for assignee) */}
      {rejected.length > 0 && (
        <div className="mt-4">
          <h4 className="font-semibold text-gray-900 text-sm mb-2">
            {t('dailyTask.approval.rejectedTitle', 'Rejected by assigner')}
          </h4>
          <ul className="space-y-2">
            {rejected.slice(0, 10).map((row) => (
              <li key={row.id} className="border border-red-100 rounded-lg p-3 bg-red-50/50 text-sm">
                <button
                  type="button"
                  onClick={() => handleTitleClick(row)}
                  className="w-full text-left font-medium text-gray-900 truncate cursor-pointer hover:text-red-700 hover:underline focus:outline-none focus:ring-1 focus:ring-red-400 rounded"
                  title={getDisplayTitle(row)}
                >
                  {getDisplayTitle(row)}
                </button>
                {row.reject_reason && (
                  <p className="text-xs text-gray-600 mt-1">{row.reject_reason}</p>
                )}
              </li>
            ))}
          </ul>
          {rejected.length > 10 && (
            <p className="text-xs text-gray-500 mt-1">{t('dailyTask.approval.showingRecent', 'Showing 10 most recent.')}</p>
          )}
        </div>
      )}

      {/* Reject reason dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={(open) => !open && setRejectDialog({ open: false, row: null, reason: '' })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('dailyTask.approval.rejectReasonTitle', 'Reject completion')}</DialogTitle>
            <DialogDescription>
              {t('dailyTask.approval.rejectReasonDesc', 'Provide a reason so the assignee knows what to adjust. The task/step will be unchecked.')}
            </DialogDescription>
          </DialogHeader>
          {rejectDialog.row && (
            <p className="text-sm text-gray-600 truncate">{getDisplayTitle(rejectDialog.row)}</p>
          )}
          <Textarea
            placeholder={t('dailyTask.approval.reasonPlaceholder', 'Reason for rejection (required)...')}
            value={rejectDialog.reason}
            onChange={(e) => setRejectDialog((prev) => ({ ...prev, reason: e.target.value }))}
            rows={3}
            className="mt-2"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, row: null, reason: '' })}>
              {t('dailyTask.approval.cancel', 'Cancel')}
            </Button>
            <Button variant="destructive" onClick={handleRejectSubmit} disabled={!rejectDialog.reason.trim() || actingId !== null}>
              {actingId ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('dailyTask.approval.reject', 'Reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve confirmation dialog (avoid accidental click) */}
      <Dialog open={!!approveConfirmRow} onOpenChange={(open) => !open && setApproveConfirmRow(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('dailyTask.approval.approveConfirmTitle', 'Konfirmasi Approve')}</DialogTitle>
            <DialogDescription>
              {t('dailyTask.approval.approveConfirmDesc', 'Yakin ingin menyetujui item ini?')}
            </DialogDescription>
          </DialogHeader>
          {approveConfirmRow && (
            <p className="text-sm text-gray-600 truncate" title={getDisplayTitle(approveConfirmRow)}>
              {getDisplayTitle(approveConfirmRow)}
            </p>
          )}
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setApproveConfirmRow(null)}>
              {t('dailyTask.approval.cancel', 'Cancel')}
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleApproveConfirm}
              disabled={actingId !== null}
            >
              {actingId ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('dailyTask.approval.approve', 'Approve')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
