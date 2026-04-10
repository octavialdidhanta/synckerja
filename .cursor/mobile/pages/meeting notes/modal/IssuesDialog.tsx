import { useState, useEffect } from 'react';
import { AlertCircle, Plus, Edit, Trash2, CheckCircle2, FileText, History, CheckSquare } from 'lucide-react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/features/ui/table';
import { useMeetingNotes } from '@/features/8-1-meeting-notes/MeetingNotesContext';
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
import UpdateHistoryDialog from '@/mobile/pages/meeting notes/modal/UpdateHistoryDialog';
import { AddSolutionAsDailyTaskModal } from '@/mobile/pages/meeting notes/modal/AddSolutionAsDailyTaskModal';

interface IssuesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  discussionPoint: string;
  meetingPointId: string;
  onIssueCountChange?: (count: number) => void;
}

const IssuesDialog = ({ isOpen, onClose, discussionPoint, meetingPointId, onIssueCountChange }: IssuesDialogProps) => {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { t } = useAppTranslation();
  const {
    getIssueHistory,
    addIssue, 
    updateIssue,
    updateIssueNotes,
    deleteIssue,
    getSolutionHistory,
    addSolution,
    updateSolution,
    updateSolutionNotes,
    deleteSolution,
    getUpdateHistory
  } = useMeetingNotes();
  
  const [issues, setIssues] = useState<any[]>([]);
  const [solutions, setSolutions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Issue form state
  const [newIssue, setNewIssue] = useState('');
  const [editingIssueId, setEditingIssueId] = useState<string | null>(null);
  const [editingIssueText, setEditingIssueText] = useState('');
  const [notesIssueId, setNotesIssueId] = useState<string | null>(null);
  const [editingIssueNotes, setEditingIssueNotes] = useState('');
  
  // Solution form state
  const [selectedIssueId, setSelectedIssueId] = useState<string>('');
  const [newSolution, setNewSolution] = useState('');
  const [editingSolutionId, setEditingSolutionId] = useState<string | null>(null);
  const [editingSolutionText, setEditingSolutionText] = useState('');
  const [notesSolutionId, setNotesSolutionId] = useState<string | null>(null);
  const [editingSolutionNotes, setEditingSolutionNotes] = useState('');
  const [updateHistorySolutionId, setUpdateHistorySolutionId] = useState<string | null>(null);
  const [solutionUpdateCounts, setSolutionUpdateCounts] = useState<Record<string, number>>({});
  
  // Add as Daily Task modal state
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
  const [selectedSolutionForTask, setSelectedSolutionForTask] = useState<any>(null);

  // Full description view popup (when description is truncated and user clicks to read full)
  const [fullDescriptionModal, setFullDescriptionModal] = useState<{ title: string; content: string } | null>(null);
  const [deletingIssueId, setDeletingIssueId] = useState<string | null>(null);
  const [deletingSolutionId, setDeletingSolutionId] = useState<string | null>(null);
  const [isDeletingIssue, setIsDeletingIssue] = useState(false);
  const [isDeletingSolution, setIsDeletingSolution] = useState(false);

  useEffect(() => {
    if (isOpen && meetingPointId) {
      loadData();
    }
  }, [isOpen, meetingPointId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [issuesData, solutionsData] = await Promise.all([
        getIssueHistory(meetingPointId),
        getSolutionHistory(meetingPointId)
      ]);
      setIssues(issuesData);
      setSolutions(solutionsData);
      if (onIssueCountChange) {
        onIssueCountChange(issuesData.length);
      }
      
      // Load update counts for each solution
      const updateCounts: Record<string, number> = {};
      for (const solution of solutionsData) {
        try {
          const updates = await getUpdateHistory(solution.id);
          updateCounts[solution.id] = updates.length;
        } catch (error) {
          logger.error(`Error loading update count for solution ${solution.id}:`, error);
          updateCounts[solution.id] = 0;
        }
      }
      setSolutionUpdateCounts(updateCounts);
    } catch (error) {
      logger.error('Error loading data:', error);
      toast({ title: 'Error', description: 'Failed to load issues and solutions', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddIssue = async () => {
    if (!newIssue.trim()) return;

    setIsSubmitting(true);
    try {
      await addIssue(meetingPointId, newIssue);
      await loadData();
      setNewIssue('');
    } catch (error) {
      logger.error('Error adding issue:', error);
      toast({ title: 'Error', description: 'Failed to add issue', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditIssue = (issueId: string, currentText: string) => {
    setEditingIssueId(issueId);
    setEditingIssueText(currentText);
  };

  const handleSaveEditIssue = async (issueId: string) => {
    if (!editingIssueText.trim()) return;

    try {
      await updateIssue(issueId, editingIssueText);
      await loadData();
      setEditingIssueId(null);
      setEditingIssueText('');
    } catch (error) {
      logger.error('Error updating issue:', error);
      toast({ title: 'Error', description: 'Failed to update issue', variant: 'destructive' });
    }
  };

  const handleCancelEditIssue = () => {
    setEditingIssueId(null);
    setEditingIssueText('');
  };

  const handleRequestDeleteIssue = (issueId: string) => {
    setDeletingIssueId(issueId);
  };

  const handleConfirmDeleteIssue = async () => {
    if (!deletingIssueId) return;
    setIsDeletingIssue(true);
    try {
      await deleteIssue(deletingIssueId);
      setDeletingIssueId(null);
      await loadData();
    } catch (error) {
      logger.error('Error deleting issue:', error);
      toast({ title: 'Error', description: 'Failed to delete issue', variant: 'destructive' });
    } finally {
      setIsDeletingIssue(false);
    }
  };

  const handleDeleteIssue = async (issueId: string) => {
    handleRequestDeleteIssue(issueId);
  };

  const handleAddSolution = async () => {
    if (!newSolution.trim() || !selectedIssueId) return;

    setIsSubmitting(true);
    try {
      await addSolution(selectedIssueId, meetingPointId, newSolution);
      await loadData();
      setNewSolution('');
      setSelectedIssueId('');
    } catch (error) {
      logger.error('Error adding solution:', error);
      toast({ title: 'Error', description: 'Failed to add solution', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSolution = (solutionId: string, currentText: string) => {
    setEditingSolutionId(solutionId);
    setEditingSolutionText(currentText);
  };

  const handleSaveEditSolution = async (solutionId: string) => {
    if (!editingSolutionText.trim()) return;

    try {
      await updateSolution(solutionId, editingSolutionText);
      await loadData();
      setEditingSolutionId(null);
      setEditingSolutionText('');
    } catch (error) {
      logger.error('Error updating solution:', error);
      toast({ title: 'Error', description: 'Failed to update solution', variant: 'destructive' });
    }
  };

  const handleCancelEditSolution = () => {
    setEditingSolutionId(null);
    setEditingSolutionText('');
  };

  const handleRequestDeleteSolution = (solutionId: string) => {
    setDeletingSolutionId(solutionId);
  };

  const handleConfirmDeleteSolution = async () => {
    if (!deletingSolutionId) return;
    setIsDeletingSolution(true);
    try {
      await deleteSolution(deletingSolutionId);
      setDeletingSolutionId(null);
      await loadData();
    } catch (error) {
      logger.error('Error deleting solution:', error);
      toast({ title: 'Error', description: 'Failed to delete solution', variant: 'destructive' });
    } finally {
      setIsDeletingSolution(false);
    }
  };

  const handleDeleteSolution = async (solutionId: string) => {
    handleRequestDeleteSolution(solutionId);
  };

  const handleOpenIssueNotes = (issue: any) => {
    setNotesIssueId(issue.id);
    setEditingIssueNotes(issue.notes || '');
  };

  const handleSaveIssueNotes = async (issueId: string) => {
    try {
      await updateIssueNotes(issueId, editingIssueNotes);
      await loadData();
      setNotesIssueId(null);
      setEditingIssueNotes('');
    } catch (error) {
      logger.error('Error saving issue notes:', error);
      toast({ title: 'Error', description: 'Failed to save issue notes', variant: 'destructive' });
    }
  };

  const handleCancelIssueNotes = () => {
    setNotesIssueId(null);
    setEditingIssueNotes('');
  };

  const handleOpenSolutionNotes = (solution: any) => {
    setNotesSolutionId(solution.id);
    setEditingSolutionNotes(solution.notes || '');
  };

  const handleSaveSolutionNotes = async (solutionId: string) => {
    try {
      await updateSolutionNotes(solutionId, editingSolutionNotes);
      await loadData();
      setNotesSolutionId(null);
      setEditingSolutionNotes('');
    } catch (error) {
      logger.error('Error saving solution notes:', error);
      toast({ title: 'Error', description: 'Failed to save solution notes', variant: 'destructive' });
    }
  };

  const handleCancelSolutionNotes = () => {
    setNotesSolutionId(null);
    setEditingSolutionNotes('');
  };

  const handleAddAsDailyTask = (solution: any) => {
    setSelectedSolutionForTask(solution);
    setIsAddTaskModalOpen(true);
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

  const getIssueDescription = (issueId: string) => {
    const issue = issues.find(i => i.id === issueId);
    return issue?.issue_description || 'Unknown Issue';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          'w-full max-w-none m-0 rounded-none translate-x-0 translate-y-0 flex flex-col p-0 gap-0 border-none bg-card shadow-xl focus:outline-none overflow-hidden',
          isMobile
            ? 'fixed left-0 right-0 top-0 modal-above-safe-area h-screen'
            : 'md:w-[70vmin] md:h-[70vmin] md:max-w-[70vmin] md:max-h-[70vmin] md:rounded-lg md:translate-x-[-50%] md:translate-y-[-50%] md:left-[50%] md:top-[50%] fixed inset-0 md:h-auto md:max-h-[90vh]'
        )}
        fullscreenAnimation={isMobile}
        hideCloseButton={isMobile}
      >
        <DialogHeader className={cn(
          'flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-left',
          isMobile ? 'safe-area-top px-4 pt-4 pb-3' : 'md:px-6 md:pt-6 md:pb-4'
        )}>
          <DialogTitle className="text-lg font-semibold flex items-center gap-2 text-foreground">
            <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
            <span className="lowercase truncate">Issues & Solutions: {discussionPoint}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll px-6 pt-4 pb-6 md:px-4 md:pb-4">
          <div className="flex flex-col space-y-6 pt-4">
          {/* ========== ISSUES SECTION ========== */}
          <div>
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-5 border border-orange-100 mb-4">
              <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4 text-orange-600" />
                Add New Issue
              </h4>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="new-issue" className="text-sm font-medium text-gray-700 mb-2 block">
                    Issue
                  </Label>
                  <Textarea
                    id="new-issue"
                    placeholder="Describe the problem or issue that needs to be addressed..."
                    value={newIssue}
                    onChange={(e) => setNewIssue(e.target.value)}
                    className="text-sm min-h-[80px] resize-none bg-white border border-gray-200 focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                  />
                </div>

                <Button
                  onClick={handleAddIssue}
                  disabled={!newIssue.trim() || isSubmitting}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 font-medium"
                >
                  {isSubmitting ? 'Adding...' : 'Add Issue'}
                </Button>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 md:sticky md:top-0 z-10 md:shadow-sm">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-orange-600" />
                  Issues Table ({issues.length})
                </h4>
              </div>
              
              <div className="overflow-x-auto seamless-scroll">
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px] min-w-[50px] shrink-0">#</TableHead>
                      <TableHead className="min-w-[320px]">Issue Description</TableHead>
                      <TableHead className="w-[150px] min-w-[140px] shrink-0">Created</TableHead>
                      <TableHead className="w-[120px] min-w-[120px] shrink-0">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600 mx-auto mb-2"></div>
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : issues.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          <p className="font-medium">No issues yet</p>
                          <p className="text-sm">Add the first issue above to get started.</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      issues.map((issue, index) => (
                        <TableRow key={issue.id}>
                          <TableCell className="text-center text-gray-600 font-medium">
                            {index + 1}
                          </TableCell>
                          <TableCell className="min-w-[320px] align-top">
                            {editingIssueId === issue.id ? (
                              <div className="space-y-2">
                                <Textarea
                                  value={editingIssueText}
                                  onChange={(e) => setEditingIssueText(e.target.value)}
                                  className="text-sm min-h-[60px] resize-none bg-white border border-gray-200 focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                                />
                                <div className="flex items-center gap-2 justify-end">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCancelEditIssue}
                                    className="px-3 py-1 text-xs"
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    onClick={() => handleSaveEditIssue(issue.id)}
                                    disabled={!editingIssueText.trim()}
                                    className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 text-xs"
                                  >
                                    Save
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <p
                                role="button"
                                tabIndex={0}
                                className="text-gray-900 text-sm leading-relaxed line-clamp-2 cursor-pointer hover:bg-orange-50/50 rounded px-1 -mx-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFullDescriptionModal({ title: 'Issue Description', content: issue.issue_description });
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setFullDescriptionModal({ title: 'Issue Description', content: issue.issue_description });
                                  }
                                }}
                              >
                                {issue.issue_description}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                            {formatDateTime(issue.created_at)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenIssueNotes(issue)}
                                className={`h-7 w-7 p-0 hover:bg-blue-50 hover:text-blue-600 ${issue.notes ? 'text-blue-600' : ''}`}
                                title={issue.notes ? 'View/Edit notes' : 'Add notes'}
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditIssue(issue.id, issue.issue_description)}
                                className="h-7 w-7 p-0 hover:bg-orange-50 hover:text-orange-600"
                                title="Edit issue"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteIssue(issue.id)}
                                className="h-7 w-7 p-0 hover:bg-red-50 hover:text-red-600"
                                title="Delete issue"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          {/* ========== SOLUTIONS SECTION ========== */}
          <div>
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-5 border border-green-100 mb-4">
              <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4 text-green-600" />
                Add New Solution
              </h4>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="select-issue" className="text-sm font-medium text-gray-700 mb-2 block">
                    Select Issue
                  </Label>
                  <Select value={selectedIssueId} onValueChange={setSelectedIssueId}>
                    <SelectTrigger className="text-sm bg-white border border-gray-200 focus:border-green-300 w-full">
                      <SelectValue placeholder="Select an issue to add solution..." />
                    </SelectTrigger>
                    <SelectContent className="bg-white border shadow-lg max-h-[200px] w-full max-w-[calc(100vw-2rem)] md:min-w-[400px] md:max-w-none">
                      {issues.length === 0 ? (
                        <div className="px-2 py-4 text-sm text-gray-500 text-center">
                          No issues available. Add an issue first.
                        </div>
                      ) : (
                        issues.map((issue) => (
                          <SelectItem key={issue.id} value={issue.id} className="whitespace-normal">
                            <div className="w-full">
                              <p className="text-sm break-words">{issue.issue_description}</p>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="new-solution" className="text-sm font-medium text-gray-700 mb-2 block">
                    Solution
                  </Label>
                  <Textarea
                    id="new-solution"
                    placeholder="Describe the solution for the selected issue..."
                    value={newSolution}
                    onChange={(e) => setNewSolution(e.target.value)}
                    className="text-sm min-h-[80px] resize-none bg-white border border-gray-200 focus:border-green-300 focus:ring-2 focus:ring-green-100"
                  />
                </div>

                <Button
                  onClick={handleAddSolution}
                  disabled={!newSolution.trim() || !selectedIssueId || isSubmitting}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 font-medium"
                >
                  {isSubmitting ? 'Adding...' : 'Add Solution'}
                </Button>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 md:sticky md:top-0 z-10 md:shadow-sm">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  Solutions Table ({solutions.length})
                </h4>
              </div>
              
              <div className="overflow-x-auto seamless-scroll">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px] min-w-[50px] shrink-0">#</TableHead>
                      <TableHead className="min-w-[180px]">Issue Reference</TableHead>
                      <TableHead className="min-w-[320px]">Solution Description</TableHead>
                      <TableHead className="w-[150px] min-w-[140px] shrink-0">Created</TableHead>
                      <TableHead className="w-[100px] min-w-[100px] shrink-0">Updates</TableHead>
                      <TableHead className="w-[120px] min-w-[120px] shrink-0">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto mb-2"></div>
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : solutions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          <p className="font-medium">No solutions yet</p>
                          <p className="text-sm">Add the first solution above to get started.</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      solutions.map((solution, index) => (
                        <TableRow key={solution.id}>
                          <TableCell className="text-center text-gray-600 font-medium">
                            {index + 1}
                          </TableCell>
                          <TableCell className="min-w-[180px] align-top">
                            <div className="bg-orange-50 border border-orange-200 rounded-md p-2">
                              <p className="text-xs text-orange-800 font-medium line-clamp-2">
                                {getIssueDescription(solution.meeting_point_issue_id)}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="min-w-[320px] align-top">
                            {editingSolutionId === solution.id ? (
                              <div className="space-y-2">
                                <Textarea
                                  value={editingSolutionText}
                                  onChange={(e) => setEditingSolutionText(e.target.value)}
                                  className="text-sm min-h-[60px] resize-none bg-white border border-gray-200 focus:border-green-300 focus:ring-2 focus:ring-green-100"
                                />
                                <div className="flex items-center gap-2 justify-end">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCancelEditSolution}
                                    className="px-3 py-1 text-xs"
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    onClick={() => handleSaveEditSolution(solution.id)}
                                    disabled={!editingSolutionText.trim()}
                                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 text-xs"
                                  >
                                    Save
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <p
                                role="button"
                                tabIndex={0}
                                className="text-gray-900 text-sm leading-relaxed line-clamp-2 cursor-pointer hover:bg-green-50/50 rounded px-1 -mx-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFullDescriptionModal({ title: 'Solution Description', content: solution.solution_description });
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setFullDescriptionModal({ title: 'Solution Description', content: solution.solution_description });
                                  }
                                }}
                              >
                                {solution.solution_description}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                            {formatDateTime(solution.created_at)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setUpdateHistorySolutionId(solution.id)}
                              className="h-7 px-2 text-xs hover:bg-blue-50 hover:text-blue-600 text-blue-600 border border-blue-200"
                              title="View update history"
                            >
                              <History className="w-3 h-3 mr-1" />
                              {solutionUpdateCounts[solution.id] || 0}
                            </Button>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAddAsDailyTask(solution)}
                                className="h-7 w-7 p-0 hover:bg-purple-50 hover:text-purple-600"
                                title="Add as Daily task"
                              >
                                <CheckSquare className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenSolutionNotes(solution)}
                                className={`h-7 w-7 p-0 hover:bg-blue-50 hover:text-blue-600 ${solution.notes ? 'text-blue-600' : ''}`}
                                title={solution.notes ? 'View/Edit notes' : 'Add notes'}
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditSolution(solution.id, solution.solution_description)}
                                className="h-7 w-7 p-0 hover:bg-green-50 hover:text-green-600"
                                title="Edit solution"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteSolution(solution.id)}
                                className="h-7 w-7 p-0 hover:bg-red-50 hover:text-red-600"
                                title="Delete solution"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
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

      <AlertDialog open={!!deletingIssueId} onOpenChange={(open) => !open && setDeletingIssueId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete issue</AlertDialogTitle>
            <AlertDialogDescription>
              {t('meetingNotes.issues.confirmDeleteIssue', 'Are you sure you want to delete this issue? All associated solutions will also be deleted.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingIssue}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteIssue} disabled={isDeletingIssue} className="bg-red-600 hover:bg-red-700">
              {isDeletingIssue ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingSolutionId} onOpenChange={(open) => !open && setDeletingSolutionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete solution</AlertDialogTitle>
            <AlertDialogDescription>
              {t('meetingNotes.issues.confirmDeleteSolution', 'Are you sure you want to delete this solution?')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingSolution}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteSolution} disabled={isDeletingSolution} className="bg-red-600 hover:bg-red-700">
              {isDeletingSolution ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Full description popup (read full Issue/Solution description) */}
      <Dialog open={!!fullDescriptionModal} onOpenChange={(open) => !open && setFullDescriptionModal(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg">{fullDescriptionModal?.title}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto rounded-md border bg-muted/30 p-4">
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {fullDescriptionModal?.content}
            </p>
          </div>
          <div className="flex justify-end pt-3">
            <Button variant="outline" onClick={() => setFullDescriptionModal(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Issue Notes Dialog - rules: header safe-area-top px-4 pt-4 pb-3, footer two-layer no safe-area-padding-bottom, size="sm", form text-sm */}
      {notesIssueId && (
        <Dialog open={!!notesIssueId} onOpenChange={handleCancelIssueNotes}>
          <DialogContent
            className={cn(
              'w-full max-w-none m-0 rounded-none translate-x-0 translate-y-0 flex flex-col p-0 gap-0 border-none bg-card shadow-xl focus:outline-none overflow-hidden',
              isMobile
                ? 'fixed left-0 right-0 top-0 modal-above-safe-area h-screen'
                : 'md:max-w-2xl md:rounded-lg md:translate-x-[-50%] md:translate-y-[-50%] md:left-[50%] md:top-[50%] fixed inset-0 md:h-auto md:max-h-[90vh]'
            )}
            fullscreenAnimation={isMobile}
            hideCloseButton={isMobile}
          >
            <DialogHeader className={cn(
              'flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-left',
              isMobile ? 'safe-area-top px-4 pt-4 pb-3' : 'md:px-6 md:pt-6 md:pb-4'
            )}>
              <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                <span className="lowercase truncate">Issue Notes</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll px-6 pt-4 pb-6 md:px-4 md:pb-4">
              <div>
                <Label htmlFor="issue-notes" className="text-sm font-medium text-gray-700 mb-2 block">
                  Notes
                </Label>
                <Textarea
                  id="issue-notes"
                  placeholder="Add notes or comments for this issue..."
                  value={editingIssueNotes}
                  onChange={(e) => setEditingIssueNotes(e.target.value)}
                  className="text-sm min-h-[150px] resize-none bg-white border border-gray-200 focus:border-orange-300 focus:ring-2 focus:ring-orange-100 break-words max-w-full"
                />
              </div>
            </div>
            <div className="px-4 pt-3 pb-3 flex-shrink-0 border-t bg-muted/30">
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleCancelIssueNotes} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleSaveIssueNotes(notesIssueId)}
                  className="min-w-[120px] flex items-center justify-center gap-1.5 w-full sm:w-auto"
                >
                  Save Notes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Solution Notes Dialog - rules: header safe-area-top px-4 pt-4 pb-3, footer two-layer no safe-area-padding-bottom, size="sm", form text-sm */}
      {notesSolutionId && (
        <Dialog open={!!notesSolutionId} onOpenChange={handleCancelSolutionNotes}>
          <DialogContent
            className={cn(
              'w-full max-w-none m-0 rounded-none translate-x-0 translate-y-0 flex flex-col p-0 gap-0 border-none bg-card shadow-xl focus:outline-none overflow-hidden',
              isMobile
                ? 'fixed left-0 right-0 top-0 modal-above-safe-area h-screen'
                : 'md:max-w-2xl md:rounded-lg md:translate-x-[-50%] md:translate-y-[-50%] md:left-[50%] md:top-[50%] fixed inset-0 md:h-auto md:max-h-[90vh]'
            )}
            fullscreenAnimation={isMobile}
            hideCloseButton={isMobile}
          >
            <DialogHeader className={cn(
              'flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-left',
              isMobile ? 'safe-area-top px-4 pt-4 pb-3' : 'md:px-6 md:pt-6 md:pb-4'
            )}>
              <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                <span className="lowercase truncate">Solution Notes</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll px-6 pt-4 pb-6 md:px-4 md:pb-4">
              <div>
                <Label htmlFor="solution-notes" className="text-sm font-medium text-gray-700 mb-2 block">
                  Notes
                </Label>
                <Textarea
                  id="solution-notes"
                  placeholder="Add notes or comments for this solution..."
                  value={editingSolutionNotes}
                  onChange={(e) => setEditingSolutionNotes(e.target.value)}
                  className="text-sm min-h-[150px] resize-none bg-white border border-gray-200 focus:border-green-300 focus:ring-2 focus:ring-green-100 break-words max-w-full"
                />
              </div>
            </div>
            <div className="px-4 pt-3 pb-3 flex-shrink-0 border-t bg-muted/30">
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleCancelSolutionNotes} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleSaveSolutionNotes(notesSolutionId)}
                  className="min-w-[120px] flex items-center justify-center gap-1.5 w-full sm:w-auto"
                >
                  Save Notes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Update History Dialog */}
      {updateHistorySolutionId && (
        <UpdateHistoryDialog
          isOpen={!!updateHistorySolutionId}
          onClose={() => {
            setUpdateHistorySolutionId(null);
            // Reload data to refresh update counts
            loadData();
          }}
          discussionPoint={discussionPoint}
          meetingPointId={meetingPointId}
          solutionId={updateHistorySolutionId}
        />
      )}

      {/* Add Solution as Daily Task Modal */}
      {selectedSolutionForTask && (
        <AddSolutionAsDailyTaskModal
          isOpen={isAddTaskModalOpen}
          onClose={() => {
            setIsAddTaskModalOpen(false);
            setSelectedSolutionForTask(null);
          }}
          solution={selectedSolutionForTask}
          meetingPointId={meetingPointId}
          discussionPoint={discussionPoint}
        />
      )}
    </Dialog>
  );
};

export default IssuesDialog;

