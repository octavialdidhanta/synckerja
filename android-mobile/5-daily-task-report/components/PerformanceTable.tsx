import React, { useMemo, useState, useEffect } from 'react';
import { useDailyTaskReport } from '@/8-2-DailyTaskReport/context/ReportContext';
import { BlockerDetailsModal } from '@/8-2-DailyTaskReport/components/BlockerDetailsModal';
import { CheckCircle, ClipboardList, Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useToast } from '@/shared/components/ui/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { Skeleton } from '@/mobile-app/components/ui/skeleton';
import { logger } from '@/shared/lib/logger';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

interface ResolvedBlockerRow {
  id: string;
  task_step_history_id: string;
  taskTitle: string;
  stepTitle: string;
  subStepTitle: string | null;
  resolved_at: string;
  blocker_description: string;
  resolution_details: string;
  days_to_resolve: number;
  blocker_created_at: string;
}

export const PerformanceTable = () => {
  const { filtered: rows, getBlockersForStep, filteredBlockers } = useDailyTaskReport();
  const { organizationId } = useCurrentOrg();
  const { toast } = useToast();
  const { t } = useAppTranslation();
  const [openForStep, setOpenForStep] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'performance' | 'resolved'>('performance');
  const [resolvedRows, setResolvedRows] = useState<ResolvedBlockerRow[]>([]);
  const [loadingResolved, setLoadingResolved] = useState(false);
  const [editingRow, setEditingRow] = useState<ResolvedBlockerRow | null>(null);
  const [editResolutionText, setEditResolutionText] = useState('');
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Get all resolved blockers from context
  const resolvedBlockers = useMemo(() => {
    return (filteredBlockers || []).filter((b: any) => b.is_resolved);
  }, [filteredBlockers]);

  // Fetch resolved blocker details when switching to resolved view
  useEffect(() => {
    let cancelled = false;

    const fetchResolvedDetails = async () => {
      if (viewMode !== 'resolved' || !organizationId) return;

      setLoadingResolved(true);
      try {
        const { data: resolvedData, error } = await supabase.rpc('get_all_resolved_blockers', {
          p_organization_id: organizationId,
          p_limit: 100
        });

        if (cancelled) return;
        if (error) {
          logger.error('Error loading resolved blockers:', error);
          setResolvedRows([]);
          setLoadingResolved(false);
          return;
        }

        if (!resolvedData || resolvedData.length === 0) {
          setResolvedRows([]);
          setLoadingResolved(false);
          return;
        }

        const mapped: ResolvedBlockerRow[] = resolvedData.map((row: any) => {
          const createdAt = new Date(row.blocker_created_at);
          const resolvedAt = new Date(row.resolved_at || row.blocker_created_at);
          const daysToResolve = Math.ceil((resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

          return {
            id: row.blocker_resolved_id || row.id,
            task_step_history_id: row.task_step_history_id || row.id,
            taskTitle: row.task_title || '-',
            stepTitle: row.step_title || '-',
            subStepTitle: row.sub_step_title,
            resolved_at: row.resolved_at || row.blocker_created_at,
            blocker_description: row.blocker_description || '-',
            resolution_details: row.resolution_description || 'No resolution details provided',
            days_to_resolve: Math.max(0, daysToResolve),
            blocker_created_at: row.blocker_created_at
          };
        });

        if (cancelled) return;
        setResolvedRows(mapped);
      } catch (error) {
        if (cancelled) return;
        logger.error('Error in fetchResolvedDetails:', error);
        setResolvedRows([]);
      } finally {
        if (!cancelled) setLoadingResolved(false);
      }
    };

    fetchResolvedDetails();
    return () => { cancelled = true; };
  }, [viewMode, organizationId]);

  const handleEditResolution = (row: ResolvedBlockerRow) => {
    setEditingRow(row);
    setEditResolutionText(row.resolution_details);
  };

  const handleSaveEdit = async () => {
    if (!editingRow || isSaving) return;

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('task_step_history_blocker_resolved')
        .update({ description: editResolutionText.trim() })
        .eq('id', editingRow.id)
        .select()
        .single();

      if (error) {
        logger.error('Error updating resolution:', error);
        toast({
          title: t('dailyTaskReport.toast.error', 'Error'),
          description: `${t('dailyTaskReport.errors.updateResolution', 'Failed to update resolution')}: ${error.message}`,
          variant: 'destructive',
        });
        return;
      }

      setResolvedRows(prev => prev.map(row => 
        row.id === editingRow.id
          ? { ...row, resolution_details: editResolutionText.trim() }
          : row
      ));

      setEditingRow(null);
      setEditResolutionText('');

      toast({
        title: t('dailyTaskReport.toast.success', 'Success'),
        description: t('dailyTaskReport.success.resolutionUpdated', 'Resolution details updated successfully'),
      });
    } catch (error: any) {
      logger.error('Unexpected error updating resolution:', error);
      toast({
        title: t('dailyTaskReport.toast.error', 'Error'),
        description: t('dailyTaskReport.errors.generic', 'An unexpected error occurred'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteResolution = async () => {
    if (!deletingRowId) return;

    setIsDeleting(true);
    try {
      const rowToDelete = resolvedRows.find(r => r.id === deletingRowId);
      if (!rowToDelete) return;

      const { error: deleteResError } = await supabase
        .from('task_step_history_blocker_resolved')
        .delete()
        .eq('id', rowToDelete.id);

      if (deleteResError) {
        logger.error('Error deleting resolution:', deleteResError);
        toast({
          title: t('dailyTaskReport.toast.error', 'Error'),
          description: `${t('dailyTaskReport.errors.deleteResolution', 'Failed to delete resolution')}: ${deleteResError.message}`,
          variant: 'destructive',
        });
        setIsDeleting(false);
        return;
      }

      const { error: updateError } = await supabase
        .from('task_step_history')
        .update({ is_resolved: false })
        .eq('id', rowToDelete.task_step_history_id);

      if (updateError) {
        logger.error('Error updating blocker status:', updateError);
        toast({
          title: t('dailyTaskReport.toast.warning', 'Warning'),
          description: t('dailyTaskReport.errors.resolutionDeletedBlockerNotUpdated', 'Resolution deleted but blocker status not updated'),
          variant: 'destructive',
        });
      }

      setResolvedRows(prev => prev.filter(row => row.id !== deletingRowId));
      setDeletingRowId(null);

      toast({
        title: t('dailyTaskReport.toast.success', 'Success'),
        description: t('dailyTaskReport.success.resolutionDeleted', 'Resolution deleted successfully'),
      });
    } catch (error: any) {
      logger.error('Error deleting resolution:', error);
      toast({
        title: t('dailyTaskReport.toast.error', 'Error'),
        description: t('dailyTaskReport.errors.generic', 'An unexpected error occurred'),
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-border bg-muted/30 px-3 py-2">
        <span className="text-sm font-medium text-foreground">
          {viewMode === 'performance' ? 'Assignments Performance' : 'Blocker Resolved'}
        </span>
        <div className="flex items-center gap-2">
          {viewMode === 'performance' ? (
            <button
              type="button"
              onClick={() => setViewMode('resolved')}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/60"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Resolved
              {resolvedBlockers.length > 0 && (
                <span className="ml-1 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {resolvedBlockers.length}
                </span>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setViewMode('performance')}
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/25 bg-primary/10 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
            >
              <ClipboardList className="h-3.5 w-3.5" />
              Performance
            </button>
          )}
        </div>
      </div>
      <div className="p-2 space-y-2">
        {viewMode === 'performance' ? (
          /* Mobile: Card-based layout for performance */
          <>
            {rows.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No data</div>
            ) : (
              rows.map((r, idx) => {
                const blockerItems = getBlockersForStep(r.stepId || '');
                const blockerCount = blockerItems.length;
                return (
                  <div key={idx} className="space-y-2 rounded-lg border border-border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 text-xs font-semibold text-foreground">{r.employeeName}</div>
                        <div className="mb-1 text-xs text-foreground/90">{r.taskTitle}</div>
                        <div className="text-xs text-muted-foreground">{r.stepTitle}</div>
                      </div>
                      <div className="flex-shrink-0">
                        {r.isOnTime === null ? (
                          <span className="text-xs text-muted-foreground">N/A</span>
                        ) : r.isOnTime ? (
                          <span className="rounded border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-200">
                            On-Time
                          </span>
                        ) : (
                          <span className="rounded border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                            Late {r.lateDays}d
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {blockerCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setOpenForStep(r.stepId || '')}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          {blockerCount} Blocker{blockerCount > 1 ? 's' : ''}
                        </button>
                      )}
                      {r.dueDate && (
                        <span>Due: {new Date(r.dueDate).toLocaleDateString()}</span>
                      )}
                      {r.finishedAt && (
                        <span>Finished: {new Date(r.finishedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </>
        ) : (
          /* Mobile: Card-based layout for resolved blockers */
          <>
            {loadingResolved ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-2 rounded-lg border border-border bg-card p-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                ))}
              </div>
            ) : resolvedRows.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No resolved blockers found</div>
            ) : (
              resolvedRows.map((row) => (
                <div key={row.id} className="space-y-2 rounded-lg border border-border bg-card p-3">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-foreground">{row.taskTitle}</div>
                    <div className="text-xs text-foreground/90">{row.stepTitle}</div>
                    {row.subStepTitle && (
                      <div className="text-xs font-medium text-muted-foreground">Sub-step: {row.subStepTitle}</div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Resolved: {new Date(row.resolved_at).toLocaleDateString('id-ID', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                  <div className="text-xs text-foreground/90">
                    <div className="mb-1 font-medium">Blocker:</div>
                    <div className="line-clamp-2">{row.blocker_description}</div>
                  </div>
                  <div className="text-xs text-foreground">
                    <div className="mb-1 font-medium">Resolution:</div>
                    <div className="line-clamp-3">{row.resolution_details}</div>
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-2">
                    <span className="inline-flex items-center rounded-md border border-primary/25 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                      {row.days_to_resolve} {row.days_to_resolve === 1 ? 'day' : 'days'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditResolution(row)}
                        className="rounded p-1.5 text-primary transition-colors hover:bg-primary/10"
                        title="Edit resolution details"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingRowId(row.id)}
                        className="rounded p-1.5 text-destructive transition-colors hover:bg-destructive/10"
                        title="Delete resolution"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
      <BlockerDetailsModal
        open={!!openForStep}
        onOpenChange={(o) => !o && setOpenForStep(null)}
        items={openForStep ? getBlockersForStep(openForStep) : []}
      />

      {/* Edit Resolution Modal - Mobile Optimized */}
      <Dialog open={!!editingRow} onOpenChange={(open) => !open && setEditingRow(null)}>
        <DialogContent className="max-w-none w-screen h-screen md:max-w-2xl md:max-h-[80vh] m-0 rounded-none md:rounded-lg flex flex-col p-0">
          <DialogHeader className="px-4 pt-4 pb-2 border-b flex-shrink-0">
            <DialogTitle className="text-base md:text-lg">Edit Resolution Details</DialogTitle>
          </DialogHeader>
          {editingRow && (
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto px-4 py-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="space-y-1 rounded border border-border bg-muted/40 p-3">
                <div className="text-xs text-muted-foreground">
                  Task: <span className="font-medium text-foreground">{editingRow.taskTitle}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Step: <span className="font-medium text-foreground">{editingRow.stepTitle}</span>
                </div>
                {editingRow.subStepTitle && (
                  <div className="text-xs text-muted-foreground">
                    Sub-step: <span className="font-medium text-foreground">{editingRow.subStepTitle}</span>
                  </div>
                )}
                <div className="mt-2 text-sm text-foreground/90">{editingRow.blocker_description}</div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Resolution Details</label>
                <Textarea
                  value={editResolutionText}
                  onChange={(e) => setEditResolutionText(e.target.value)}
                  className="min-h-[120px] w-full rounded-md border border-input px-3 py-2 focus:border-primary focus:ring-2 focus:ring-primary/30"
                  placeholder="Enter resolution details..."
                />
              </div>
            </div>
          )}
          <div className="flex flex-col-reverse md:flex-row justify-end gap-2 px-4 py-3 border-t flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => {
                setEditingRow(null);
                setEditResolutionText('');
              }}
              className="w-full md:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={!editResolutionText.trim() || isSaving}
              className="w-full md:w-auto"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingRowId} onOpenChange={(open) => !open && setDeletingRowId(null)}>
        <AlertDialogContent className="max-w-[90vw] md:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Resolution</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this resolution? This will mark the blocker as unresolved again.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse md:flex-row gap-2">
            <AlertDialogCancel disabled={isDeleting} className="w-full md:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteResolution}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 w-full md:w-auto"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

