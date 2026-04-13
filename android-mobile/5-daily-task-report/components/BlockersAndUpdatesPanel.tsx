import React, { useMemo, useState } from 'react';
import { useDailyTaskReport } from '@/8-2-DailyTaskReport/context/ReportContext';
import { BlockerDetailsModal } from '@/8-2-DailyTaskReport/components/BlockerDetailsModal';
import { BlockerResolutionModal } from '@/8-2-DailyTaskReport/components/BlockerResolutionModal';
import { supabase } from '@/shared/lib/supabaseClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { useToast } from '@/shared/components/ui/use-toast';
import { Trash2, Edit } from 'lucide-react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { logger } from '@/shared/lib/logger';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

export const BlockersAndUpdatesPanel = () => {
  const { filteredBlockers: blockers, filteredRecentUpdates: recentUpdates } = useDailyTaskReport();
  const [activeTab, setActiveTab] = useState<'blockers' | 'updates'>('blockers');
  const [open, setOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<'list' | 'resolved'>('list');
  const [resolutionFor, setResolutionFor] = useState<any | null>(null);
  const [locResolved, setLocResolved] = useState<Record<string, boolean>>({});
  const [deletingBlocker, setDeletingBlocker] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [locDeleted, setLocDeleted] = useState<Record<string, boolean>>({});
  const [editingBlocker, setEditingBlocker] = useState<any | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { t } = useAppTranslation();

  const handleResolve = async (blocker: any) => {
    setResolutionFor(blocker);
  };

  const handleResolutionComplete = async () => {
    if (!resolutionFor) return;
    
    try {
      const { error } = await supabase
        .from('task_step_history')
        .update({ is_resolved: true } as any)
        .eq('id', resolutionFor.id);
      
      if (error) {
        logger.error('Error updating blocker resolution status:', error);
        toast({
          title: t('dailyTaskReport.toast.error', 'Error'),
          description: `${t('dailyTaskReport.errors.markBlockerResolved', 'Failed to mark blocker as resolved')}: ${error.message}`,
          variant: 'destructive',
        });
        return;
      }
      
      const { data: resolutionCheck, error: checkError } = await (supabase as any)
        .rpc('get_blocker_resolutions', {
          p_task_step_history_ids: [resolutionFor.id]
        });
      
      if (checkError) {
        logger.error('Error verifying blocker resolution:', checkError);
      } else if (!resolutionCheck || resolutionCheck.length === 0) {
        logger.warn('⚠️ Blocker marked as resolved but no resolution entry found');
        toast({
          title: t('dailyTaskReport.toast.warning', 'Warning'),
          description: t('dailyTaskReport.errors.resolutionDetailsNotSaved', 'Blocker marked as resolved but resolution details may not have been saved'),
          variant: 'destructive',
        });
      }
      
      setLocResolved(prev => ({ ...prev, [resolutionFor.id]: true }));
      setResolutionFor(null);
      
      toast({
        title: t('dailyTaskReport.toast.success', 'Success'),
        description: t('dailyTaskReport.success.blockerResolved', 'Blocker marked as resolved'),
      });
    } catch (error: any) {
      logger.error('Unexpected error in handleResolutionComplete:', error);
      toast({
        title: t('dailyTaskReport.toast.error', 'Error'),
        description: t('dailyTaskReport.errors.updateBlockerStatus', 'An unexpected error occurred while updating blocker status'),
        variant: 'destructive',
      });
    }
  };

  const handleDelete = (blocker: any) => {
    setDeletingBlocker(blocker);
  };

  const confirmDelete = async () => {
    if (!deletingBlocker) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('task_step_history')
        .delete()
        .eq('id', deletingBlocker.id);

      if (error) {
        logger.error('Error deleting blocker:', error);
        toast({
          title: t('dailyTaskReport.toast.error', 'Error'),
          description: `${t('dailyTaskReport.errors.deleteBlocker', 'Failed to delete blocker')}: ${error.message}`,
          variant: 'destructive',
        });
        return;
      }

      if (deletingBlocker.is_resolved) {
        const { error: resError } = await supabase
          .from('task_step_history_blocker_resolved')
          .delete()
          .eq('task_step_history_id', deletingBlocker.id);

        if (resError) {
          logger.warn('Could not delete resolution entry:', resError);
        }
      }

      setLocDeleted(prev => ({ ...prev, [deletingBlocker.id]: true }));
      setDeletingBlocker(null);

      toast({
        title: t('dailyTaskReport.toast.success', 'Success'),
        description: t('dailyTaskReport.success.blockerDeleted', 'Blocker deleted successfully'),
      });
    } catch (error: any) {
      logger.error('Unexpected error deleting blocker:', error);
      toast({
        title: t('dailyTaskReport.toast.error', 'Error'),
        description: t('dailyTaskReport.errors.generic', 'An unexpected error occurred'),
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = (blocker: any) => {
    setEditingBlocker(blocker);
    setEditDescription(blocker.description || '');
  };

  const saveEdit = async () => {
    if (!editingBlocker || !editDescription.trim()) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('task_step_history')
        .update({ description: editDescription.trim() })
        .eq('id', editingBlocker.id);

      if (error) {
        logger.error('Error updating blocker:', error);
        toast({
          title: t('dailyTaskReport.toast.error', 'Error'),
          description: `${t('dailyTaskReport.errors.updateBlocker', 'Failed to update blocker')}: ${error.message}`,
          variant: 'destructive',
        });
        return;
      }

      setEditingBlocker(null);
      setEditDescription('');

      toast({
        title: t('dailyTaskReport.toast.success', 'Success'),
        description: t('dailyTaskReport.success.blockerUpdated', 'Blocker updated successfully'),
      });
    } catch (error: any) {
      logger.error('Unexpected error updating blocker:', error);
      toast({
        title: t('dailyTaskReport.toast.error', 'Error'),
        description: t('dailyTaskReport.errors.generic', 'An unexpected error occurred'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Filter out resolved blockers from display
  const unresolvedBlockers = useMemo(() => {
    return (blockers || []).filter((b: any) => !b.is_resolved && !locResolved[b.id] && !locDeleted[b.id]);
  }, [blockers, locResolved, locDeleted]);

  const grouped = useMemo(() => {
    const map: Record<string, Record<string, any[]>> = {};
    unresolvedBlockers.forEach((b: any) => {
      const task = b.taskTitle || '-';
      const step = b.stepTitle || '-';
      map[task] = map[task] || {};
      map[task][step] = map[task][step] || [];
      map[task][step].push(b);
    });
    return map;
  }, [unresolvedBlockers]);

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'blockers' | 'updates')} className="flex h-full flex-shrink-0 flex-col">
        <div className="border-b border-border bg-muted/30">
          <TabsList className="h-auto w-full rounded-none border-none bg-transparent p-0">
            <TabsTrigger
              value="blockers"
              className="flex-1 rounded-none border-b-2 border-transparent px-3 py-2 text-xs font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none md:text-sm"
            >
              Blockers
              {unresolvedBlockers && unresolvedBlockers.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-[10px] md:text-xs bg-red-100 text-red-700 rounded-full font-semibold">
                  {unresolvedBlockers.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="updates"
              className="flex-1 rounded-none border-b-2 border-transparent px-3 py-2 text-xs font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none md:text-sm"
            >
              Recent Updates
              {recentUpdates && recentUpdates.length > 0 && (
                <span className="ml-2 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary md:text-xs">
                  {recentUpdates.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Shared Content Area - displays blockers or updates based on activeTab */}
        <div className="m-0 flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-2 p-2 md:p-3">
          {activeTab === 'blockers' ? (
            <>
              {unresolvedBlockers.length === 0 ? (
                <div className="text-xs text-muted-foreground md:text-sm">No blockers reported.</div>
              ) : (
                Object.entries(grouped).map(([taskTitle, steps]) => (
                  <div key={taskTitle} className="mb-2 rounded-md border border-border bg-muted/30 p-2">
                    <div className="mb-1 text-xs font-semibold text-foreground md:text-sm">Task: {taskTitle}</div>
                    <div className="space-y-2">
                      {Object.entries(steps).map(([stepTitle, items]) => (
                        <div key={taskTitle + stepTitle} className="ml-1 rounded-md border border-border bg-card p-2">
                          <div className="mb-1 text-xs font-medium text-foreground md:text-sm">Step: {stepTitle}</div>
                          <div className="space-y-1 ml-1">
                            {(items as any[]).filter((b: any) => !locDeleted[b.id]).map((b: any) => (
                              <div key={b.id} className="p-2 border border-red-200 bg-red-50 rounded text-xs md:text-sm">
                                {b.subStepTitle && (
                                  <div className="text-red-700 font-semibold mb-0.5">Sub-step: {b.subStepTitle}</div>
                                )}
                                <div className="text-red-700 font-medium">{b.blocker_type || 'Blocker'}</div>
                                {b.description && <div className="text-red-800 text-xs md:text-sm">{b.description}</div>}
                                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mt-2 gap-2">
                                  <div className="text-[10px] md:text-xs text-red-600">{new Date(b.created_at).toLocaleString()}</div>
                                  <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                                    {(b.is_resolved || locResolved[b.id]) && (
                                      <span className="text-[10px] bg-green-100 text-green-700 border border-green-200 rounded px-1.5 md:px-2 py-0.5">Resolved</span>
                                    )}
                                    <button
                                      className={`text-[10px] md:text-xs rounded px-2 py-1 border ${(b.is_resolved || locResolved[b.id]) ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-green-600 text-white border-green-700 hover:bg-green-700'}`}
                                      disabled={!!(b.is_resolved || locResolved[b.id])}
                                      onClick={() => handleResolve(b)}
                                    >
                                      Resolve
                                    </button>
                                    <button
                                      type="button"
                                      className="rounded border border-primary bg-primary p-1 text-primary-foreground hover:bg-primary/90 md:p-1.5"
                                      onClick={() => handleEdit(b)}
                                      title="Edit blocker"
                                    >
                                      <Edit className="w-3 md:w-3.5 h-3 md:h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      className="rounded border border-destructive bg-destructive p-1 text-destructive-foreground hover:bg-destructive/90 md:p-1.5"
                                      onClick={() => handleDelete(b)}
                                      title="Delete blocker"
                                    >
                                      <Trash2 className="w-3 md:w-3.5 h-3 md:h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </>
          ) : (
            <>
              {(recentUpdates || []).length === 0 ? (
                <div className="text-xs text-muted-foreground md:text-sm">No updates.</div>
              ) : (
                (recentUpdates || []).map((u: any) => {
                  const isCompleted = u.action_type === 'status_change' && 
                    (u.new_value === 'completed' || u.new_value === 'COMPLETED' || 
                     u.description?.toLowerCase().includes('completed'));
                  const cardCls = isCompleted
                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30'
                    : 'border-border bg-muted/30';
                  const titleCls = isCompleted
                    ? 'font-medium text-emerald-800 dark:text-emerald-200'
                    : 'font-medium text-foreground';
                  const actionType = u.action_type?.replace(/_/g, ' ') || '';
                  
                  return (
                    <div key={u.id} className={`rounded border p-2 text-xs md:text-sm ${cardCls}`}>
                      <div className={titleCls}>{actionType}</div>
                      <div className="text-xs text-foreground/90 md:text-sm">
                        {u.description || ''}
                      </div>
                      <div className="mt-1 text-[10px] text-muted-foreground md:text-xs">
                        <div>
                          Task: <span className="font-medium text-foreground">{u.taskTitle || '-'}</span>
                        </div>
                        <div>
                          Step: <span className="font-medium text-foreground">{u.stepTitle || '-'}</span>
                        </div>
                        {u.subStepTitle && (
                          <div>
                            Sub-step: <span className="font-medium text-foreground">{u.subStepTitle}</span>
                          </div>
                        )}
                      </div>
                      <div className="mt-1 text-[10px] text-muted-foreground md:text-xs">{new Date(u.created_at).toLocaleString()}</div>
                    </div>
                  );
                })
              )}
            </>
          )}
          </div>
        </div>
      </Tabs>

      {/* Modals */}
      <BlockerDetailsModal open={open} onOpenChange={setOpen} items={blockers || []} initialTab={initialTab} />
      <BlockerResolutionModal
        open={!!resolutionFor}
        onOpenChange={(o) => {
          if (!o) {
            setResolutionFor(null);
          }
        }}
        blocker={resolutionFor ? {
          id: resolutionFor.id,
          blocker_type: resolutionFor.blocker_type,
          description: resolutionFor.description,
          created_at: resolutionFor.created_at,
          taskTitle: resolutionFor.taskTitle,
          stepTitle: resolutionFor.stepTitle,
          subStepTitle: resolutionFor.subStepTitle,
        } : null}
        onResolutionComplete={handleResolutionComplete}
      />

      {/* Edit Blocker Modal - Mobile Optimized */}
      <Dialog open={!!editingBlocker} onOpenChange={(open) => !open && setEditingBlocker(null)}>
        <DialogContent className="max-w-none w-screen h-screen md:max-w-2xl md:max-h-[80vh] m-0 rounded-none md:rounded-lg flex flex-col p-0">
          <DialogHeader className="px-4 pt-4 pb-2 border-b flex-shrink-0">
            <DialogTitle className="text-base md:text-lg">Edit Blocker</DialogTitle>
          </DialogHeader>
          {editingBlocker && (
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto px-4 py-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="space-y-1 rounded border border-border bg-muted/40 p-3">
                <div className="text-xs text-muted-foreground">
                  Task: <span className="font-medium text-foreground">{editingBlocker.taskTitle}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Step: <span className="font-medium text-foreground">{editingBlocker.stepTitle}</span>
                </div>
                {editingBlocker.subStepTitle && (
                  <div className="text-xs text-muted-foreground">
                    Sub-step: <span className="font-medium text-foreground">{editingBlocker.subStepTitle}</span>
                  </div>
                )}
                <div className="mt-2 text-xs text-muted-foreground">
                  Type: <span className="font-medium text-foreground">{editingBlocker.blocker_type}</span>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Blocker Description</label>
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="min-h-[120px] w-full rounded-md border border-input px-3 py-2 focus:border-primary focus:ring-2 focus:ring-primary/30"
                  placeholder="Enter blocker description..."
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex flex-col-reverse md:flex-row justify-end gap-2 px-4 py-3 border-t flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => {
                setEditingBlocker(null);
                setEditDescription('');
              }}
              disabled={isSaving}
              className="w-full md:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={saveEdit}
              disabled={!editDescription.trim() || isSaving}
              className="w-full md:w-auto"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingBlocker} onOpenChange={(open) => !open && setDeletingBlocker(null)}>
        <AlertDialogContent className="max-w-[90vw] md:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Blocker</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingBlocker && (
                <div className="space-y-2">
                  <p>Are you sure you want to delete this blocker?</p>
                  <div className="p-3 bg-gray-50 rounded border border-gray-200 text-sm">
                    <div className="font-medium text-gray-900 mb-1">
                      {deletingBlocker.blocker_type || 'Blocker'}
                    </div>
                    <div className="text-gray-700">{deletingBlocker.description}</div>
                    <div className="text-xs text-gray-500 mt-2">
                      Task: {deletingBlocker.taskTitle} • Step: {deletingBlocker.stepTitle}
                      {deletingBlocker.subStepTitle && ` • Sub-step: ${deletingBlocker.subStepTitle}`}
                    </div>
                  </div>
                  <p className="text-red-600 font-medium">This action cannot be undone.</p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse md:flex-row gap-2">
            <AlertDialogCancel disabled={isDeleting} className="w-full md:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 w-full md:w-auto"
            >
              {isDeleting ? 'Deleting...' : 'Delete Blocker'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

