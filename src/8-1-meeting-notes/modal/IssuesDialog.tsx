import { useState, useEffect } from 'react';
import { AlertCircle, Plus, Edit, Trash2, CheckCircle2, Clock, FileText, History, CheckSquare } from 'lucide-react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { useToast } from '@/shared/hooks/use-toast';
import { useMeetingNotes } from '../MeetingNotesContext';
import UpdateHistoryDialog from './UpdateHistoryDialog';
import { AddSolutionAsDailyTaskModal } from './AddSolutionAsDailyTaskModal';

interface IssuesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  discussionPoint: string;
  meetingPointId: string;
  onIssueCountChange?: (count: number) => void;
}

const IssuesDialog = ({ isOpen, onClose, discussionPoint, meetingPointId, onIssueCountChange }: IssuesDialogProps) => {
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
  const { toast } = useToast();

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
        } catch {
          updateCounts[solution.id] = 0;
        }
      }
      setSolutionUpdateCounts(updateCounts);
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load issues and solutions',
        variant: 'destructive'
      });
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
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to add issue',
        variant: 'destructive'
      });
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
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update issue',
        variant: 'destructive'
      });
    }
  };

  const handleCancelEditIssue = () => {
    setEditingIssueId(null);
    setEditingIssueText('');
  };

  const handleDeleteIssue = async (issueId: string) => {
    if (!window.confirm('Are you sure you want to delete this issue? All associated solutions will also be deleted.')) {
      return;
    }

    try {
      await deleteIssue(issueId);
      await loadData();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete issue',
        variant: 'destructive'
      });
    }
  };

  const handleAddSolution = async () => {
    if (!newSolution.trim() || !selectedIssueId) return;

    setIsSubmitting(true);
    try {
      await addSolution(selectedIssueId, meetingPointId, newSolution);
      await loadData();
      setNewSolution('');
      setSelectedIssueId('');
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to add solution',
        variant: 'destructive'
      });
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
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update solution',
        variant: 'destructive'
      });
    }
  };

  const handleCancelEditSolution = () => {
    setEditingSolutionId(null);
    setEditingSolutionText('');
  };

  const handleDeleteSolution = async (solutionId: string) => {
    if (!window.confirm('Are you sure you want to delete this solution?')) {
      return;
    }

    try {
      await deleteSolution(solutionId);
      await loadData();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete solution',
        variant: 'destructive'
      });
    }
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
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save issue notes',
        variant: 'destructive'
      });
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
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save solution notes',
        variant: 'destructive'
      });
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
      <DialogContent className="max-w-none w-screen h-screen md:w-[70vmin] md:h-[70vmin] md:max-w-[70vmin] md:max-h-[70vmin] border-none bg-card p-0 shadow-xl focus:outline-none flex flex-col m-0 rounded-none md:rounded-lg translate-x-0 translate-y-0 md:translate-x-[-50%] md:translate-y-[-50%] left-0 top-0 md:left-[50%] md:top-[50%] overflow-hidden">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            Issues & Solutions
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600 mt-1 line-clamp-2 font-medium">
            {discussionPoint}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto seamless-scroll px-4 py-4 md:pr-4 md:pb-4">
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
                    className="min-h-[80px] resize-none bg-white border border-gray-200 focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
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
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
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
                                  className="min-h-[60px] resize-none bg-white border border-gray-200 focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
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
                    <SelectTrigger className="bg-white border border-gray-200 focus:border-green-300 w-full">
                      <SelectValue placeholder="Select an issue to add solution..." />
                    </SelectTrigger>
                    <SelectContent className="bg-white border shadow-lg max-h-[200px] min-w-[400px]">
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
                    className="min-h-[80px] resize-none bg-white border border-gray-200 focus:border-green-300 focus:ring-2 focus:ring-green-100"
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
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
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
                                  className="min-h-[60px] resize-none bg-white border border-gray-200 focus:border-green-300 focus:ring-2 focus:ring-green-100"
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
      </DialogContent>

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

      {/* Issue Notes Dialog */}
      {notesIssueId && (
        <Dialog open={!!notesIssueId} onOpenChange={handleCancelIssueNotes}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-orange-600" />
                Issue Notes
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="issue-notes" className="text-sm font-medium text-gray-700 mb-2 block">
                  Notes
                </Label>
                <Textarea
                  id="issue-notes"
                  placeholder="Add notes or comments for this issue..."
                  value={editingIssueNotes}
                  onChange={(e) => setEditingIssueNotes(e.target.value)}
                  className="min-h-[150px] resize-none bg-white border border-gray-200 focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={handleCancelIssueNotes}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleSaveIssueNotes(notesIssueId)}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  Save Notes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Solution Notes Dialog */}
      {notesSolutionId && (
        <Dialog open={!!notesSolutionId} onOpenChange={handleCancelSolutionNotes}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-600" />
                Solution Notes
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="solution-notes" className="text-sm font-medium text-gray-700 mb-2 block">
                  Notes
                </Label>
                <Textarea
                  id="solution-notes"
                  placeholder="Add notes or comments for this solution..."
                  value={editingSolutionNotes}
                  onChange={(e) => setEditingSolutionNotes(e.target.value)}
                  className="min-h-[150px] resize-none bg-white border border-gray-200 focus:border-green-300 focus:ring-2 focus:ring-green-100"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={handleCancelSolutionNotes}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleSaveSolutionNotes(notesSolutionId)}
                  className="bg-green-600 hover:bg-green-700 text-white"
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

