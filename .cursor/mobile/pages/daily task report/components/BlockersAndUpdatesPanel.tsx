import React, { useMemo, useState } from 'react';
import { useDailyTaskReport } from '@/features/8-2-DailyTaskReport/context/ReportContext';
import { BlockerDetailsModal } from '@/features/8-2-DailyTaskReport/components/BlockerDetailsModal';
import { BlockerResolutionModal } from '@/features/8-2-DailyTaskReport/components/BlockerResolutionModal';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/features/ui/tabs';
import { useToast } from '@/features/ui/use-toast';
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
} from '@/features/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/features/ui/dialog';
import { Button } from '@/features/ui/button';
import { Textarea } from '@/features/ui/textarea';
import { logger } from '@/config/logger';
import { useAppTranslation } from '@/features/share/i18n/useAppTranslation';

export const BlockersAndUpdatesPanel = () => {
  const { filteredBlockers: blockers, filteredRecentUpdates: recentUpdates, loading } = useDailyTaskReport();
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
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'blockers' | 'updates')} className="flex flex-col flex-shrink-0 h-full">
        <div className="border-b bg-gray-50">
          <TabsList className="w-full h-auto bg-transparent p-0 rounded-none border-none">
            <TabsTrigger 
              value="blockers" 
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none px-3 py-2 text-xs md:text-sm font-medium"
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
              className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none px-3 py-2 text-xs md:text-sm font-medium"
            >
              Recent Updates
              {recentUpdates && recentUpdates.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-[10px] md:text-xs bg-blue-100 text-blue-700 rounded-full font-semibold">
                  {recentUpdates.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Shared Content Area - displays blockers or updates based on activeTab */}
        <div className="flex-1 overflow-hidden flex flex-col m-0 min-h-0">
          <div className="p-2 md:p-3 space-y-2 flex-1 min-h-0">
          {activeTab === 'blockers' ? (
            <>
              {unresolvedBlockers.length === 0 ? (
                <div className="text-xs md:text-sm text-gray-500">No blockers reported.</div>
              ) : (
                Object.entries(grouped).map(([taskTitle, steps]) => (
                  <div key={taskTitle} className="border border-gray-200 rounded-md bg-gray-50 p-2 mb-2">
                    <div className="text-xs md:text-sm font-semibold text-gray-900 mb-1">Task: {taskTitle}</div>
                    <div className="space-y-2">
                      {Object.entries(steps).map(([stepTitle, items]) => (
                        <div key={taskTitle + stepTitle} className="border border-gray-200 rounded-md bg-white p-2 ml-1">
                          <div className="text-xs md:text-sm font-medium text-gray-800 mb-1">Step: {stepTitle}</div>
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
                                      className="p-1 md:p-1.5 rounded border bg-blue-600 text-white border-blue-700 hover:bg-blue-700"
                                      onClick={() => handleEdit(b)}
                                      title="Edit blocker"
                                    >
                                      <Edit className="w-3 md:w-3.5 h-3 md:h-3.5" />
                                    </button>
                                    <button
                                      className="p-1 md:p-1.5 rounded border bg-red-600 text-white border-red-700 hover:bg-red-700"
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
                <div className="text-xs md:text-sm text-gray-500">No updates.</div>
              ) : (
                (recentUpdates || []).map((u: any) => {
                  const isCompleted = u.action_type === 'status_change' && 
                    (u.new_value === 'completed' || u.new_value === 'COMPLETED' || 
                     u.description?.toLowerCase().includes('completed'));
                  const cardCls = isCompleted ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50';
                  const titleCls = isCompleted ? 'text-green-700 font-medium' : 'text-gray-900 font-medium';
                  const actionType = u.action_type?.replace(/_/g, ' ') || '';
                  
                  return (
                    <div key={u.id} className={`p-2 border rounded text-xs md:text-sm ${cardCls}`}>
                      <div className={titleCls}>{actionType}</div>
                      <div className="text-gray-700 text-xs md:text-sm">
                        {u.description || ''}
                      </div>
                      <div className="text-[10px] md:text-xs text-gray-600 mt-1">
                        <div>Task: <span className="font-medium text-gray-800">{u.taskTitle || '-'}</span></div>
                        <div>Step: <span className="font-medium text-gray-800">{u.stepTitle || '-'}</span></div>
                        {u.subStepTitle && (
                          <div>Sub-step: <span className="font-medium text-gray-800">{u.subStepTitle}</span></div>
                        )}
                      </div>
                      <div className="text-[10px] md:text-xs text-gray-500 mt-1">{new Date(u.created_at).toLocaleString()}</div>
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
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 seamless-scroll min-h-0">
              <div className="p-3 bg-gray-50 rounded border border-gray-200 space-y-1">
                <div className="text-xs text-gray-600">
                  Task: <span className="font-medium text-gray-900">{editingBlocker.taskTitle}</span>
                </div>
                <div className="text-xs text-gray-600">
                  Step: <span className="font-medium text-gray-900">{editingBlocker.stepTitle}</span>
                </div>
                {editingBlocker.subStepTitle && (
                  <div className="text-xs text-gray-600">
                    Sub-step: <span className="font-medium text-gray-900">{editingBlocker.subStepTitle}</span>
                  </div>
                )}
                <div className="text-xs text-gray-600 mt-2">
                  Type: <span className="font-medium text-gray-900">{editingBlocker.blocker_type}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Blocker Description</label>
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full min-h-[120px] px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

