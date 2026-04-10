import { useState, useEffect } from 'react';
import { History, Clock, User, Plus, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/features/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/features/ui/dialog';
import { Textarea } from '@/features/ui/textarea';
import { useIsMobile } from '@/mobile/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Label } from '@/features/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/features/ui/select';
import { ScrollArea } from '@/features/ui/scroll-area';
import { useMeetingNotes } from '@/features/8-1-meeting-notes/MeetingNotesContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/features/1-login/hooks/use-toast';
import { logger } from '@/config/logger';
import { useAppTranslation } from '@/features/share/i18n/useAppTranslation';
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

interface UpdateHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  discussionPoint: string;
  meetingPointId: string;
  solutionId?: string; // Optional: if provided, show updates only for this solution
}

const UpdateHistoryDialog = ({ isOpen, onClose, discussionPoint, meetingPointId, solutionId }: UpdateHistoryDialogProps) => {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { t } = useAppTranslation();
  const { getUpdateHistoryByMeetingPoint, getUpdateHistory, addUpdate, updateUpdate, deleteUpdate, getIssueHistory } = useMeetingNotes();
  const [updateHistory, setUpdateHistory] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [solutions, setSolutions] = useState<any[]>([]);
  const [allSolutions, setAllSolutions] = useState<any[]>([]); // Store all solutions for filtering
  const [selectedIssueId, setSelectedIssueId] = useState<string>('');
  const [selectedSolutionId, setSelectedSolutionId] = useState<string>('');
  const [newUpdate, setNewUpdate] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUpdateId, setEditingUpdateId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [showNoSolutionAlert, setShowNoSolutionAlert] = useState(false);
  const [deletingUpdateId, setDeletingUpdateId] = useState<string | null>(null);
  const [isDeletingUpdate, setIsDeletingUpdate] = useState(false);

  useEffect(() => {
    if (isOpen && meetingPointId) {
      if (!solutionId) {
        // Only load issues if not called from IssuesDialog (no solutionId)
        loadIssues();
      }
      loadSolutions();
      // Don't load update history here, let the other useEffect handle it after solutions are loaded
    } else if (!isOpen) {
      // Reset states when dialog closes
      setSelectedIssueId('');
      setSelectedSolutionId('');
      setIssues([]);
      setSolutions([]);
      setAllSolutions([]);
      setUpdateHistory([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, meetingPointId, solutionId]);

  // Filter solutions when issue is selected
  useEffect(() => {
    if (selectedIssueId && allSolutions.length > 0) {
      const filtered = allSolutions.filter(sol => sol.meeting_point_issue_id === selectedIssueId);
      setSolutions(filtered);
      // Reset selected solution if it's not in the filtered list
      if (selectedSolutionId && !filtered.find(s => s.id === selectedSolutionId)) {
        setSelectedSolutionId('');
      } else if (filtered.length > 0 && !selectedSolutionId) {
        // Auto-select first solution if available
        setSelectedSolutionId(filtered[0].id);
      }
    } else if (!selectedIssueId && allSolutions.length > 0) {
      // Show all solutions if no issue is selected
      setSolutions(allSolutions);
      // Auto-select first solution if available and not already selected
      if (allSolutions.length > 0 && !selectedSolutionId) {
        setSelectedSolutionId(allSolutions[0].id);
      }
    }
  }, [selectedIssueId, allSolutions, selectedSolutionId]);

  // Reload update history when selectedIssueId or selectedSolutionId changes
  useEffect(() => {
    if (isOpen && meetingPointId && allSolutions.length > 0) {
      // Only reload if we have solutions loaded
      loadUpdateHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIssueId, selectedSolutionId, allSolutions.length]);

  const loadIssues = async () => {
    try {
      const issuesData = await getIssueHistory(meetingPointId);
      setIssues(issuesData);
      
      // Auto-select first issue if available
      if (issuesData.length > 0 && !selectedIssueId) {
        setSelectedIssueId(issuesData[0].id);
      }
    } catch (error) {
      logger.error('Error loading issues:', error);
      toast({ title: 'Error', description: 'Failed to load issues', variant: 'destructive' });
    }
  };

  const loadSolutions = async () => {
    try {
      const { data, error } = await supabase
        .from('meeting_point_solutions')
        .select('id, solution_description, meeting_point_issue_id')
        .eq('meeting_point_id', meetingPointId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setAllSolutions(data || []);
      
      // If solutionId is provided, use it and filter solutions
      if (solutionId) {
        setSelectedSolutionId(solutionId);
        // Find the solution to get its issue_id
        const solution = data?.find(s => s.id === solutionId);
        if (solution) {
        setSelectedIssueId(solution.meeting_point_issue_id);
        setSolutions([solution]);
      }
    } else {
      // If no solutionId, solutions will be filtered by selectedIssueId in useEffect
      // Don't auto-select here, let the useEffect handle it
      }
    } catch (error) {
      logger.error('Error loading solutions:', error);
      toast({ title: 'Error', description: 'Failed to load solutions', variant: 'destructive' });
    }
  };

  const loadUpdateHistory = async () => {
    setIsLoading(true);
    try {
      // If solutionId is provided, get updates only for that solution
      if (solutionId) {
        const history = await getUpdateHistory(solutionId);
        setUpdateHistory(history);
      } else if (selectedSolutionId) {
        // If solution is selected, get updates only for that solution
        const history = await getUpdateHistory(selectedSolutionId);
        setUpdateHistory(history);
      } else if (selectedIssueId) {
        // If issue is selected but no solution, get updates for all solutions of that issue
        const issueSolutions = allSolutions.filter(sol => sol.meeting_point_issue_id === selectedIssueId);
        if (issueSolutions.length > 0) {
          const solutionIds = issueSolutions.map(s => s.id);
          const { data, error } = await supabase
            .from('meeting_point_updates')
            .select('*')
            .in('meeting_point_solution_id', solutionIds)
            .order('created_at', { ascending: false });
          
          if (error) throw error;
          setUpdateHistory(data || []);
        } else {
          setUpdateHistory([]);
        }
      } else {
        // If nothing is selected, get all updates for the meeting point
        const history = await getUpdateHistoryByMeetingPoint(meetingPointId);
        setUpdateHistory(history);
      }
    } catch (error) {
      logger.error('Error loading update history:', error);
      toast({ title: 'Error', description: 'Failed to load update history', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUpdate = async () => {
    if (!newUpdate.trim()) return;
    
    // If no solution selected and solutions exist, select the first one
    if (!selectedSolutionId && solutions.length > 0) {
      setSelectedSolutionId(solutions[0].id);
    }
    
    // If still no solution, show alert dialog
    if (!selectedSolutionId) {
      setShowNoSolutionAlert(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const statusToSet = newStatus || 'On Going';
      await addUpdate(selectedSolutionId, newUpdate, statusToSet);
      
      // Reload the update history to show the new update
      await loadUpdateHistory();
      
      setNewUpdate('');
      setNewStatus('');
    } catch (error) {
      logger.error('Error adding update:', error);
      toast({ title: 'Error', description: 'Failed to add update', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const handleEditUpdate = (updateId: string, currentText: string) => {
    setEditingUpdateId(updateId);
    setEditingText(currentText);
  };

  const handleSaveEdit = async (updateId: string) => {
    if (!editingText.trim()) return;

    try {
      await updateUpdate(updateId, editingText);
      
      // Reload update history
      await loadUpdateHistory();
      setEditingUpdateId(null);
      setEditingText('');
    } catch (error) {
      logger.error('Error updating:', error);
      toast({ title: 'Error', description: 'Failed to update', variant: 'destructive' });
    }
  };

  const handleCancelEdit = () => {
    setEditingUpdateId(null);
    setEditingText('');
  };

  const handleRequestDeleteUpdate = (updateId: string) => {
    setDeletingUpdateId(updateId);
  };

  const handleConfirmDeleteUpdate = async () => {
    if (!deletingUpdateId) return;
    setIsDeletingUpdate(true);
    try {
      await deleteUpdate(deletingUpdateId);
      setDeletingUpdateId(null);
      await loadUpdateHistory();
    } catch (error) {
      logger.error('Error deleting update:', error);
      toast({ title: 'Error', description: 'Failed to delete update', variant: 'destructive' });
    } finally {
      setIsDeletingUpdate(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          'w-full max-w-none m-0 rounded-none translate-x-0 translate-y-0 flex flex-col p-0 gap-0 border-none bg-card shadow-xl focus:outline-none overflow-hidden',
          isMobile
            ? 'fixed left-0 right-0 top-0 modal-above-safe-area h-screen'
            : 'md:max-w-4xl md:max-h-[85vh] md:rounded-lg md:translate-x-[-50%] md:translate-y-[-50%] md:left-[50%] md:top-[50%] fixed inset-0 md:h-auto md:max-h-[90vh]'
        )}
        fullscreenAnimation={isMobile}
        hideCloseButton={isMobile}
      >
        <DialogHeader className={cn(
          'flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-left',
          isMobile ? 'safe-area-top px-4 pt-4 pb-3' : 'md:px-6 md:pt-6 md:pb-4'
        )}>
          <DialogTitle className="text-lg font-semibold flex items-center gap-2 text-foreground">
            <History className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <span className="lowercase truncate">Update History: {discussionPoint}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll px-6 pt-4 pb-6 md:px-4 md:pb-4">
          <div className="flex-1 flex flex-col space-y-6">
            {/* Add New Update Section */}
            <div className="flex-shrink-0 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3 md:p-5 border border-blue-100">
              <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2 text-sm md:text-base">
                <Plus className="w-4 h-4 text-blue-600 flex-shrink-0" />
                Add Progress Update
              </h4>
              
              <div className="space-y-4">
                {/* Show Issues dropdown only if not called from IssuesDialog (no solutionId) */}
                {!solutionId && (
                  <div>
                    <Label htmlFor="issue-select" className="text-sm font-medium text-foreground mb-2 block">
                      Select Issue
                    </Label>
                    {issues.length === 0 ? (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800 break-words">
                        <p>No issues available. Please create an issue first in the Issues dialog.</p>
                      </div>
                    ) : (
                      <Select 
                        value={selectedIssueId} 
                        onValueChange={setSelectedIssueId}
                      >
                        <SelectTrigger className="text-sm bg-white border border-gray-200 focus:border-blue-300 w-full">
                          <SelectValue placeholder="Select an issue..." />
                        </SelectTrigger>
                        <SelectContent className="bg-white border shadow-lg max-h-[200px] w-full max-w-[calc(100vw-2rem)] md:min-w-[300px] md:max-w-none">
                          {issues.map((issue) => (
                            <SelectItem key={issue.id} value={issue.id}>
                              <div className="max-w-full">
                                <p className="text-sm break-words">{issue.issue_description}</p>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}

                {solutions.length === 0 ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 md:p-4 text-sm text-yellow-800 break-words">
                    <p className="font-medium mb-1">No solutions available</p>
                    {!solutionId && selectedIssueId ? (
                      <p>No solutions found for the selected issue. Please create a solution first in the Issues dialog.</p>
                    ) : (
                      <p>Please create a solution first in the Issues dialog before adding updates.</p>
                    )}
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="solution-select" className="text-sm font-medium text-foreground mb-2 block">
                      {solutionId ? 'Solution' : 'Select Solution'}
                    </Label>
                    <Select 
                      value={selectedSolutionId} 
                      onValueChange={setSelectedSolutionId}
                      disabled={!!solutionId}
                    >
                      <SelectTrigger className="text-sm bg-white border border-gray-200 focus:border-blue-300 w-full">
                        <SelectValue placeholder="Select a solution..." />
                      </SelectTrigger>
                      <SelectContent className="bg-white border shadow-lg max-h-[200px] w-full max-w-[calc(100vw-2rem)] md:min-w-[300px] md:max-w-none">
                        {solutions.map((solution) => (
                          <SelectItem key={solution.id} value={solution.id}>
                            {solution.solution_description.length > 60 
                              ? `${solution.solution_description.substring(0, 60)}...` 
                              : solution.solution_description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <div>
                  <Label htmlFor="new-update" className="text-sm font-medium text-foreground mb-2 block">
                    Update Details
                  </Label>
                  <Textarea
                    id="new-update"
                    placeholder="Describe the progress or changes made..."
                    value={newUpdate}
                    onChange={(e) => setNewUpdate(e.target.value)}
                    className="text-sm min-h-[80px] resize-none bg-white border border-gray-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 break-words max-w-full"
                    disabled={solutions.length === 0}
                  />
                </div>

                <div className="flex flex-col md:flex-row items-stretch md:items-end gap-4">
                  <div className="flex-1 w-full">
                    <Label htmlFor="status-update" className="text-sm font-medium text-foreground mb-2 block">
                      Update Status (Optional)
                    </Label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger className="text-sm bg-white border border-gray-200 focus:border-blue-300 w-full">
                        <SelectValue placeholder="Keep current status or change..." />
                      </SelectTrigger>
                    <SelectContent className="bg-white border shadow-lg w-full max-w-[calc(100vw-2rem)] md:min-w-[200px] md:max-w-none">
                      <SelectItem value="On Going">On Going</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Rejected">Rejected</SelectItem>
                      <SelectItem value="Presented">Presented</SelectItem>
                    </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={handleAddUpdate}
                    disabled={!newUpdate.trim() || isSubmitting || solutions.length === 0}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 font-medium w-full md:w-auto"
                  >
                    {isSubmitting ? 'Adding...' : 'Add Update'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Update History Section */}
            <div className="flex-1 overflow-hidden">
              <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2 text-sm md:text-base">
                <Clock className="w-4 h-4 text-gray-600 flex-shrink-0" />
                Update History ({updateHistory.length})
              </h4>
              
              <ScrollArea className="h-full max-h-[400px]">
                <div className="space-y-3 pr-4">
                  {isLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                      Loading update history...
                    </div>
                  ) : updateHistory.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground bg-muted/50 rounded-lg">
                      <Clock className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="font-medium">No updates yet</p>
                      <p className="text-sm">Add the first update above to get started.</p>
                    </div>
                  ) : (
                    updateHistory.map((update, index) => (
                      <div 
                        key={update.id} 
                        className="bg-card rounded-lg border border-border p-3 md:p-4 hover:shadow-sm transition-shadow"
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="w-3 h-3 flex-shrink-0" />
                            <span className="font-medium">System Update</span>
                            {index === 0 && (
                              <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium">
                                Latest
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <span className="text-xs text-muted-foreground font-mono">
                              {formatDateTime(update.created_at)}
                            </span>
                            <div className="flex items-center gap-1 ml-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditUpdate(update.id, update.update_details)}
                                className="h-7 w-7 p-0 hover:bg-blue-50 hover:text-blue-600"
                                title="Edit update"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRequestDeleteUpdate(update.id)}
                                className="h-7 w-7 p-0 hover:bg-red-50 hover:text-red-600"
                                title="Delete update"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                        
                        {editingUpdateId === update.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              className="text-sm min-h-[80px] resize-none bg-white border border-gray-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 break-words max-w-full"
                            />
                            <div className="flex items-center gap-2 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleCancelEdit}
                                className="px-3 py-1 text-xs"
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={() => handleSaveEdit(update.id)}
                                disabled={!editingText.trim()}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 text-xs"
                              >
                                Save
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-foreground text-sm whitespace-pre-wrap leading-relaxed break-words">
                            {update.update_details}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>

        {/* Footer - rules: px-4 pt-3 pb-3, no safe-area-padding-bottom, two-layer, size="sm" */}
        <div className="px-4 pt-3 pb-3 flex-shrink-0 border-t bg-muted/30">
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="w-full sm:w-auto">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>

      <AlertDialog open={showNoSolutionAlert} onOpenChange={setShowNoSolutionAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Info</AlertDialogTitle>
            <AlertDialogDescription>
              {t('meetingNotes.updateHistory.noSolutionAlert', 'Please create a solution first before adding updates. You can create solutions in the Issues dialog.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowNoSolutionAlert(false)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingUpdateId} onOpenChange={(open) => !open && setDeletingUpdateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete update</AlertDialogTitle>
            <AlertDialogDescription>
              {t('meetingNotes.updateHistory.confirmDeleteUpdate', 'Are you sure you want to delete this update?')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingUpdate}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteUpdate} disabled={isDeletingUpdate} className="bg-red-600 hover:bg-red-700">
              {isDeletingUpdate ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};

export default UpdateHistoryDialog;

