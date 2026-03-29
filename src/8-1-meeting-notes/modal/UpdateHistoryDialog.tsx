
import { useState, useEffect } from 'react';
import { History, Clock, User, Plus, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Textarea } from '@/shared/components/ui/textarea';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { useToast } from '@/shared/hooks/use-toast';
import { useMeetingNotes } from '@/8-1-meeting-notes/MeetingNotesContext';
import { supabase } from '@/shared/lib/supabaseClient';

interface UpdateHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  discussionPoint: string;
  meetingPointId: string;
  solutionId?: string; // Optional: if provided, show updates only for this solution
}

const UpdateHistoryDialog = ({ isOpen, onClose, discussionPoint, meetingPointId, solutionId }: UpdateHistoryDialogProps) => {
  const { toast } = useToast();
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

  useEffect(() => {
    if (isOpen && meetingPointId) {
      if (!solutionId) {
        // Only load issues if not called from IssuesDialog (no solutionId); set first issue after load to avoid stale closure
        loadIssues().then((issuesData) => {
          if (issuesData && issuesData.length > 0) {
            setSelectedIssueId(issuesData[0].id);
          }
        });
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

  const loadIssues = async (): Promise<any[] | undefined> => {
    try {
      const issuesData = await getIssueHistory(meetingPointId);
      setIssues(issuesData);
      return issuesData;
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load issues',
        variant: 'destructive'
      });
      return undefined;
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
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load solutions',
        variant: 'destructive'
      });
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
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load update history',
        variant: 'destructive'
      });
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
    
    // If still no solution, show alert
    if (!selectedSolutionId) {
      alert('Please create a solution first before adding updates. You can create solutions in the Issues dialog.');
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
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to add update',
        variant: 'destructive'
      });
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
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update',
        variant: 'destructive'
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingUpdateId(null);
    setEditingText('');
  };

  const handleDeleteUpdate = async (updateId: string) => {
    if (!window.confirm('Are you sure you want to delete this update?')) {
      return;
    }

    try {
      await deleteUpdate(updateId);
      
      // Reload update history
      await loadUpdateHistory();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete update',
        variant: 'destructive'
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0 pb-4 border-b">
          <div className="flex-1 pr-4">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <History className="w-5 h-5 text-blue-600" />
              Update History
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 mt-1 line-clamp-2 font-medium">
              {discussionPoint}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-6 pt-4">
          {/* Add New Update Section */}
          <div className="flex-shrink-0 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-600" />
              Add Progress Update
            </h4>
            
            <div className="space-y-4">
              {/* Show Issues dropdown only if not called from IssuesDialog (no solutionId) */}
              {!solutionId && (
                <div>
                  <Label htmlFor="issue-select" className="text-sm font-medium text-gray-700 mb-2 block">
                    Select Issue
                  </Label>
                  {issues.length === 0 ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                      <p>No issues available. Please create an issue first in the Issues dialog.</p>
                    </div>
                  ) : (
                    <Select 
                      value={selectedIssueId} 
                      onValueChange={setSelectedIssueId}
                    >
                      <SelectTrigger className="bg-white border border-gray-200 focus:border-blue-300">
                        <SelectValue placeholder="Select an issue..." />
                      </SelectTrigger>
                      <SelectContent className="bg-white border shadow-lg max-h-[200px]">
                        {issues.map((issue) => (
                          <SelectItem key={issue.id} value={issue.id}>
                            <div className="max-w-md">
                              <p className="text-sm truncate">{issue.issue_description}</p>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {solutions.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
                  <p className="font-medium mb-1">No solutions available</p>
                  {!solutionId && selectedIssueId ? (
                    <p>No solutions found for the selected issue. Please create a solution first in the Issues dialog.</p>
                  ) : (
                    <p>Please create a solution first in the Issues dialog before adding updates.</p>
                  )}
                </div>
              ) : (
                <div>
                  <Label htmlFor="solution-select" className="text-sm font-medium text-gray-700 mb-2 block">
                    {solutionId ? 'Solution' : 'Select Solution'}
                  </Label>
                  <Select 
                    value={selectedSolutionId} 
                    onValueChange={setSelectedSolutionId}
                    disabled={!!solutionId}
                  >
                    <SelectTrigger className="bg-white border border-gray-200 focus:border-blue-300">
                      <SelectValue placeholder="Select a solution..." />
                    </SelectTrigger>
                    <SelectContent className="bg-white border shadow-lg max-h-[200px]">
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
                <Label htmlFor="new-update" className="text-sm font-medium text-gray-700 mb-2 block">
                  Update Details
                </Label>
                <Textarea
                  id="new-update"
                  placeholder="Describe the progress or changes made..."
                  value={newUpdate}
                  onChange={(e) => setNewUpdate(e.target.value)}
                  className="min-h-[80px] resize-none bg-white border border-gray-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  disabled={solutions.length === 0}
                />
              </div>

              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <Label htmlFor="status-update" className="text-sm font-medium text-gray-700 mb-2 block">
                    Update Status (Optional)
                  </Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger className="bg-white border border-gray-200 focus:border-blue-300">
                      <SelectValue placeholder="Keep current status or change..." />
                    </SelectTrigger>
                    <SelectContent className="bg-white border shadow-lg">
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
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 font-medium"
                >
                  {isSubmitting ? 'Adding...' : 'Add Update'}
                </Button>
              </div>
            </div>
          </div>

          {/* Update History Section */}
          <div className="flex-1 overflow-hidden">
            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-600" />
              Update History ({updateHistory.length})
            </h4>
            
            <ScrollArea className="h-full max-h-[400px]">
              <div className="space-y-3 pr-4">
                {isLoading ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    Loading update history...
                  </div>
                ) : updateHistory.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                    <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="font-medium">No updates yet</p>
                    <p className="text-sm">Add the first update above to get started.</p>
                  </div>
                ) : (
                  updateHistory.map((update, index) => (
                    <div 
                      key={update.id} 
                      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <User className="w-3 h-3" />
                          <span className="font-medium">System Update</span>
                          {index === 0 && (
                            <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium">
                              Latest
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 font-mono">
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
                              onClick={() => handleDeleteUpdate(update.id)}
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
                            className="min-h-[80px] resize-none bg-white border border-gray-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
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
                        <p className="text-gray-900 text-sm whitespace-pre-wrap leading-relaxed">
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
      </DialogContent>
    </Dialog>
  );
};

export default UpdateHistoryDialog;
