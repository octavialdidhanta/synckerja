import React, { useMemo, useState, useEffect } from 'react';
import { useDailyTaskReport } from '@/features/8-2-DailyTaskReport/context/ReportContext';
import { BlockerDetailsModal } from '@/features/8-2-DailyTaskReport/components/BlockerDetailsModal';
import { CheckCircle, ClipboardList, Edit, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrg } from '@/features/1-login/hooks/useCurrentOrg';
import { useToast } from '@/features/ui/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/features/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/features/ui/dialog';
import { Button } from '@/features/ui/button';
import { Textarea } from '@/features/ui/textarea';
import { Skeleton } from '@/mobile/components/ui/skeleton';
import { logger } from '@/config/logger';
import { useAppTranslation } from '@/features/share/i18n/useAppTranslation';

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
  const { filtered: rows, loading, getBlockersForStep, filteredBlockers, filters } = useDailyTaskReport();
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
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col">
      <div className="px-3 py-2 border-b bg-gray-50 flex items-center justify-between flex-shrink-0">
        <span className="text-sm font-medium">
          {viewMode === 'performance' ? 'Assignments Performance' : 'Blocker Resolved'}
        </span>
        <div className="flex items-center gap-2">
          {viewMode === 'performance' ? (
            <button
              onClick={() => setViewMode('resolved')}
              className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Resolved
              {resolvedBlockers.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-green-600 text-white rounded-full font-semibold">
                  {resolvedBlockers.length}
                </span>
              )}
            </button>
          ) : (
            <button
              onClick={() => setViewMode('performance')}
              className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
            >
              <ClipboardList className="w-3.5 h-3.5" />
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
              <div className="text-sm text-gray-500 text-center py-8">No data</div>
            ) : (
              rows.map((r, idx) => {
                const blockerItems = getBlockersForStep(r.stepId || '');
                const blockerCount = blockerItems.length;
                return (
                  <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-white space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-gray-900 mb-1">{r.employeeName}</div>
                        <div className="text-xs text-gray-700 mb-1">{r.taskTitle}</div>
                        <div className="text-xs text-gray-600">{r.stepTitle}</div>
                      </div>
                      <div className="flex-shrink-0">
                        {r.isOnTime === null ? (
                          <span className="text-xs text-gray-500">N/A</span>
                        ) : r.isOnTime ? (
                          <span className="text-xs bg-green-100 text-green-700 border border-green-200 rounded px-2 py-0.5">On-Time</span>
                        ) : (
                          <span className="text-xs bg-red-100 text-red-700 border border-red-200 rounded px-2 py-0.5">Late {r.lateDays}d</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                      {blockerCount > 0 && (
                        <button
                          onClick={() => setOpenForStep(r.stepId || '')}
                          className="text-xs font-medium text-purple-700 hover:underline"
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
                  <div key={i} className="border border-gray-200 rounded-lg p-3 bg-white space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                ))}
              </div>
            ) : resolvedRows.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-8">No resolved blockers found</div>
            ) : (
              resolvedRows.map((row) => (
                <div key={row.id} className="border border-gray-200 rounded-lg p-3 bg-white space-y-2">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-gray-900">{row.taskTitle}</div>
                    <div className="text-xs text-gray-700">{row.stepTitle}</div>
                    {row.subStepTitle && (
                      <div className="text-xs text-gray-600 font-medium">Sub-step: {row.subStepTitle}</div>
                    )}
                  </div>
                  <div className="text-xs text-gray-600">
                    Resolved: {new Date(row.resolved_at).toLocaleDateString('id-ID', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                  <div className="text-xs text-gray-700">
                    <div className="font-medium mb-1">Blocker:</div>
                    <div className="line-clamp-2">{row.blocker_description}</div>
                  </div>
                  <div className="text-xs text-gray-900">
                    <div className="font-medium mb-1">Resolution:</div>
                    <div className="line-clamp-3">{row.resolution_details}</div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                    <span className="inline-flex items-center px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200 rounded-md">
                      {row.days_to_resolve} {row.days_to_resolve === 1 ? 'day' : 'days'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditResolution(row)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit resolution details"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingRowId(row.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete resolution"
                      >
                        <Trash2 className="w-4 h-4" />
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
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 seamless-scroll min-h-0">
              <div className="p-3 bg-gray-50 rounded border border-gray-200 space-y-1">
                <div className="text-xs text-gray-600">
                  Task: <span className="font-medium text-gray-900">{editingRow.taskTitle}</span>
                </div>
                <div className="text-xs text-gray-600">
                  Step: <span className="font-medium text-gray-900">{editingRow.stepTitle}</span>
                </div>
                {editingRow.subStepTitle && (
                  <div className="text-xs text-gray-600">
                    Sub-step: <span className="font-medium text-gray-900">{editingRow.subStepTitle}</span>
                  </div>
                )}
                <div className="text-sm text-gray-700 mt-2">{editingRow.blocker_description}</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Resolution Details</label>
                <Textarea
                  value={editResolutionText}
                  onChange={(e) => setEditResolutionText(e.target.value)}
                  className="w-full min-h-[120px] px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

