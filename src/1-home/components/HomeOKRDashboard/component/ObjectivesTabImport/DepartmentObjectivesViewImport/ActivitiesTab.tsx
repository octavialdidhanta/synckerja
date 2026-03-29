import React, { useState, useEffect, useCallback } from 'react';
import { Plus, FileText, Paperclip, Upload, X, Users, Calendar, Clock, CheckCircle, AlertCircle, MoreHorizontal, Edit, Trash2, Eye, ChevronDown, ChevronRight, Flag, User, CheckSquare, Square, GripVertical } from 'lucide-react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import './ActivitiesTab.css';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { Progress } from '@/shared/components/ui/progress';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/shared/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/shared/components/ui/dialog';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/shared/components/ui/dropdown-menu';
import { useToast } from '@/shared/components/ui/use-toast';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { TaskStep } from '@/8-2-DailyTask/section/TaskStep';
import { AssignStepDialog } from '@/8-2-DailyTask/section/AssignStepDialog';
import { AddStepModal } from './AddStepModal';
import { MeetingNotesProvider } from '@/8-1-meeting-notes/MeetingNotesContext';

interface TaskFile {
  id: string;
  task_steps_id: string;
  filename: string;
  file_url: string;
  file_size: number;
  created_at: string;
}

interface TaskStep {
  id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  order: number;
  created_at: string;
  assigned_to?: string | null;
  assigned_at?: string | null;
  assigned_by?: string | null;
  files?: TaskFile[];
  assigned_employee?: { id: string; full_name: string; email?: string };
  assigned_by_employee?: { id: string; full_name: string; email?: string };
}

interface DailyTask {
  id: string;
  organization_id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  due_date?: string;
  finish_date?: string;
  created_at: string;
  updated_at: string;
  steps: TaskStep[];
  progress_percentage: number;
  assigned_to_name?: string;
}

interface ActivitiesTabProps {
  objectiveId: string;
  objectiveTitle: string;
}

export const ActivitiesTab: React.FC<ActivitiesTabProps> = ({ 
  objectiveId, 
  objectiveTitle 
}) => {
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedStep, setSelectedStep] = useState<TaskStep | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [addStepDialog, setAddStepDialog] = useState<{ isOpen: boolean; taskId: string | null; taskTitle: string }>({ isOpen: false, taskId: null, taskTitle: '' });
  
  const { toast } = useToast();
  const { organizationId } = useCurrentOrg();
  const { data: currentEmployee } = useCurrentEmployee();

  // Badge functions matching daily-task style
  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      pending: 'border-border bg-muted text-muted-foreground',
      in_progress: 'border-primary/20 bg-info-muted text-info-foreground',
      completed: 'border-primary/20 bg-success-muted text-success-foreground',
      cancelled: 'border-warning-muted bg-warning-muted text-warning-foreground',
    };
    
    return (
      <Badge className={`${variants[status] || ''} px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap`}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, string> = {
      low: 'border-primary/20 bg-success-muted text-success-foreground',
      medium: 'border-primary/20 bg-info-muted text-info-foreground',
      high: 'border-warning-muted bg-warning-muted text-warning-foreground',
      urgent: 'border-destructive/30 bg-destructive/10 text-destructive',
    };
    
    return (
      <Badge className={`${variants[priority] || ''} px-2 py-1 text-xs font-medium rounded-md`}>
        <Flag className="w-3 h-3 mr-1" />
        {priority.toUpperCase()}
      </Badge>
    );
  };

  useEffect(() => {
    if (organizationId && objectiveId) {
      fetchTasks();
      
      // Set up real-time subscription for daily tasks
      const channel = supabase
        .channel('daily-tasks-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'daily_tasks',
            filter: `organization_id=eq.${organizationId}&objective_id=eq.${objectiveId}`
          },
          () => {
            console.log('ðŸ”„ Daily tasks changed, refetching...');
            fetchTasks();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [organizationId, objectiveId]);

  const assignTaskStep = async (stepId: string, employeeId: string | null) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: currentEmployee } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .single();

      const updateData: any = {
        assigned_to: employeeId,
        assigned_at: employeeId ? new Date().toISOString() : null,
        assigned_by: employeeId ? ((currentEmployee as any)?.id || null) : null
      };

      const { error } = await (supabase as any)
        .from('task_steps')
        .update(updateData)
        .eq('id', stepId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: employeeId ? 'Step assigned successfully' : 'Step unassigned successfully'
      });
      
      await fetchTasks();
    } catch (error) {
      console.error('Error assigning step:', error);
      toast({
        title: 'Error',
        description: 'Failed to assign step',
        variant: 'destructive'
      });
    }
  };

  const fetchTasks = useCallback(async () => {
    if (!organizationId) return;

    try {
      setLoading(true);

      // Fetch tasks without the old assigned_to relationship
      const { data, error } = await (supabase as any)
        .from('daily_tasks')
        .select(`
          *,
          task_steps (
            *,
            task_files (*)
          )
        `)
        .eq('organization_id', organizationId)
        .eq('objective_id', objectiveId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch task assignments separately
      const taskIds = (data || []).map((task: any) => task.id);
      let assignmentsData: any[] = [];
      
      if (taskIds.length > 0) {
        const { data: assignments, error: assignmentsError } = await supabase
          .from('daily_tasks_assigned')
          .select(`
            daily_task_id,
            employee_id,
            employee:employees!employee_id(id, full_name, email)
          `)
          .in('daily_task_id', taskIds);

        if (!assignmentsError && assignments) {
          assignmentsData = assignments;
        }
      }

      // Fetch step assignments separately
      const allStepIds: string[] = [];
      (data || []).forEach((task: any) => {
        if (task.task_steps) {
          task.task_steps.forEach((step: any) => {
            if (step.id) allStepIds.push(step.id);
          });
        }
      });

      let stepAssignmentsData: any[] = [];
      if (allStepIds.length > 0) {
        const { data: stepAssignments, error: stepAssignmentsError } = await supabase
          .from('task_steps_assigned')
          .select(`
            task_step_id,
            employee_id,
            assigned_by,
            assigned_at,
            employee:employees!employee_id(id, full_name, email)
          `)
          .in('task_step_id', allStepIds);

        if (!stepAssignmentsError && stepAssignments) {
          stepAssignmentsData = stepAssignments;
        }
      }

      // Create a map of assignments by task ID
      const assignmentsByTaskId: Record<string, any> = {};
      assignmentsData.forEach((assignment: any) => {
        if (!assignmentsByTaskId[assignment.daily_task_id]) {
          assignmentsByTaskId[assignment.daily_task_id] = assignment;
        }
      });

      // Create a map of assignments by step ID
      const assignmentsByStepId: Record<string, any> = {};
      stepAssignmentsData.forEach((assignment: any) => {
        if (!assignmentsByStepId[assignment.task_step_id]) {
          assignmentsByStepId[assignment.task_step_id] = assignment;
        }
      });
      
      const transformedTasks = (data || []).map((task: any) => {
        const steps = (task.task_steps || []).map((step: any) => {
          // Get step assignment info from the separate assignments query
          const stepAssignment = assignmentsByStepId[step.id];
          
          return {
            ...step,
            files: step.task_files || [],
            assigned_employee: stepAssignment?.employee || null,
            assigned_to: stepAssignment?.employee_id || null,
            assigned_by: stepAssignment?.assigned_by || null
          };
        });

        // Get assignment info from the separate assignments query
        const assignment = assignmentsByTaskId[task.id];
        const assignedEmployee = assignment?.employee;

        return {
          ...task,
          steps,
          progress_percentage: calculateProgress(steps),
          assigned_to: assignment?.employee_id || null,
          assigned_to_name: assignedEmployee?.full_name || null
        };
      });

      setTasks(transformedTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch tasks',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [organizationId, objectiveId, toast]);

  const calculateProgress = (steps: TaskStep[]): number => {
    if (!steps.length) return 0;
    const completedSteps = steps.filter(step => step.is_completed).length;
    return Math.round((completedSteps / steps.length) * 100);
  };

  /** Task counts as "completed" for display only when all steps are done (progress 100%). */
  const isTaskFullyCompleteBySteps = (task: DailyTask) =>
    task.steps.length > 0 && task.progress_percentage === 100;

  const createTask = async () => {
    if (!newTaskTitle.trim() || !organizationId || !currentEmployee) return;

    try {
      const { data, error } = await (supabase as any)
        .from('daily_tasks')
        .insert({
          organization_id: organizationId,
          objective_id: objectiveId,
          title: newTaskTitle.trim(),
          description: newTaskDescription.trim() || null,
          priority: newTaskPriority,
          due_date: newTaskDueDate || null,
          status: 'pending',
          assigned_to: (currentEmployee as any).id,
          created_by: (currentEmployee as any).user_id
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Task created successfully',
      });

      setNewTaskTitle('');
      setNewTaskDescription('');
      setNewTaskPriority('medium');
      setNewTaskDueDate('');
      setShowAddModal(false);
      await fetchTasks();
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        title: 'Error',
        description: 'Failed to create task',
        variant: 'destructive',
      });
    }
  };

  const updateStep = async (stepId: string, updates: Partial<TaskStep>) => {
    try {
      const { error } = await (supabase as any)
        .from('task_steps')
        .update(updates)
        .eq('id', stepId);

      if (error) throw error;

      await fetchTasks();
    } catch (error) {
      console.error('Error updating step:', error);
      toast({
        title: 'Error',
        description: 'Failed to update step',
        variant: 'destructive',
      });
    }
  };

  const deleteStep = async (stepId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('task_steps')
        .delete()
        .eq('id', stepId);

      if (error) throw error;

      await fetchTasks();
    } catch (error) {
      console.error('Error deleting step:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete step',
        variant: 'destructive',
      });
    }
  };

  const uploadFile = async (stepId: string, file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${stepId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('task-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('task-files')
        .getPublicUrl(fileName);

      const { error: insertError } = await (supabase as any)
        .from('task_files')
        .insert({
          task_steps_id: stepId,
          filename: file.name,
          file_url: publicUrl,
          file_size: file.size
        });

      if (insertError) throw insertError;

      await fetchTasks();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload file',
        variant: 'destructive',
      });
    }
  };

  const deleteFile = async (fileId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('task_files')
        .delete()
        .eq('id', fileId);

      if (error) throw error;

      await fetchTasks();
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete file',
        variant: 'destructive',
      });
    }
  };

  const handleAssignStep = async (employeeId: string) => {
    if (!selectedStep) return;
    
    try {
      await assignTaskStep(selectedStep.id, employeeId);
      setShowAssignDialog(false);
      setSelectedStep(null);
      await fetchTasks();
    } catch (error) {
      console.error('Error assigning step:', error);
    }
  };

  const handleUnassignStep = async () => {
    if (!selectedStep) return;
    
    try {
      await assignTaskStep(selectedStep.id, null);
      setShowAssignDialog(false);
      setSelectedStep(null);
      await fetchTasks();
    } catch (error) {
      console.error('Error unassigning step:', error);
    }
  };

  const toggleTaskExpansion = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (expandedTasks.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const handleStatusToggle = async (taskId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
      await updateTaskStatus(taskId, newStatus);
    } catch (error) {
      console.error('Error updating task status:', error);
      toast({
        title: "Error",
        description: "Failed to update task status",
        variant: "destructive",
      });
    }
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    try {
      // Use type assertion to bypass TypeScript issues
      const { error } = await (supabase as any)
        .from('daily_tasks')
        .update({ 
          status: status,
          finish_date: status === 'completed' ? new Date().toISOString() : null
        })
        .eq('id', taskId);

      if (error) throw error;

      // Update local state
      setTasks(prev => prev.map(task => 
        task.id === taskId 
          ? { 
              ...task, 
              status: status as any,
              finish_date: status === 'completed' ? new Date().toISOString() : null
            }
          : task
      ));

      toast({
        title: "Success",
        description: `Task ${status === 'completed' ? 'completed' : 'reopened'}`,
      });
    } catch (error: any) {
      throw error;
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('daily_tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      // Update local state
      setTasks(prev => prev.filter(task => task.id !== taskId));

      toast({
        title: "Success",
        description: "Task deleted successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const addTaskStep = async (taskId: string, title: string) => {
    try {
      if (!organizationId || !currentEmployee) {
        throw new Error('Organization ID or current employee not available');
      }

      // Get the current highest order for this task
      const { data: existingSteps, error: fetchError } = await (supabase as any)
        .from('task_steps')
        .select('order')
        .eq('task_id', taskId)
        .order('order', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;

      const nextOrder = existingSteps && existingSteps.length > 0 ? existingSteps[0].order + 1 : 1;

      const { error } = await (supabase as any)
        .from('task_steps')
        .insert({
          task_id: taskId,
          title: title.trim(),
          is_completed: false,
          order: nextOrder,
          assigned_to: (currentEmployee as any).id,
          assigned_at: new Date().toISOString(),
          assigned_by: (currentEmployee as any).id
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Step added successfully',
      });

      await fetchTasks();
    } catch (error: any) {
      console.error('Error adding step:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add step',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Drag and drop handlers for steps
  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) {
      return;
    }

    // Extract step IDs from the drag event
    const activeId = active.id as string;
    const overId = over.id as string;
    
    // Check if we're reordering steps within a task
    if (activeId.startsWith('step-') && overId.startsWith('step-')) {
      const activeStepId = activeId.replace('step-', '');
      const overStepId = overId.replace('step-', '');
      
      // Find the task that contains these steps
      const task = tasks.find(t => 
        t.steps.some(s => s.id === activeStepId) && 
        t.steps.some(s => s.id === overStepId)
      );
      
      if (task) {
        // Get the steps in their current order
        const sortedSteps = task.steps.sort((a, b) => a.order - b.order);
        const activeIndex = sortedSteps.findIndex(s => s.id === activeStepId);
        const overIndex = sortedSteps.findIndex(s => s.id === overStepId);
        
        if (activeIndex !== -1 && overIndex !== -1) {
          // Create new order array
          const newSteps = [...sortedSteps];
          const [removed] = newSteps.splice(activeIndex, 1);
          newSteps.splice(overIndex, 0, removed);
          
          // Extract step IDs in new order
          const stepIds = newSteps.map(step => step.id);
          
          // Call reorder function
          reorderTaskSteps(task.id, stepIds);
        }
      }
    }
  };

  const reorderTaskSteps = async (taskId: string, stepIds: string[]) => {
    try {
      // Check if we have organizationId
      if (!organizationId) {
        throw new Error('No organization ID available');
      }

      // Update order for each step using Promise.all for batch update
      const updatePromises = stepIds.map((stepId, index) => 
        (supabase as any)
          .from('task_steps')
          .update({ order: index + 1 })
          .eq('id', stepId)
          .eq('task_id', taskId)
      );

      await Promise.all(updatePromises);

      toast({
        title: "Success",
        description: 'Steps reordered successfully'
      });
      
      // Refresh data immediately
      await fetchTasks();
    } catch (error: any) {
      console.error('âŒ Error reordering steps:', error);
      toast({
        title: "Error",
        description: `Failed to reorder steps: ${error.message}`,
        variant: "destructive",
      });
      throw error;
    }
  };

  if (loading) {
    return (
      <MeetingNotesProvider>
        <div className="flex items-center justify-center p-8">
          <div className="text-gray-500">Loading activities...</div>
        </div>
      </MeetingNotesProvider>
    );
  }

  return (
    <MeetingNotesProvider>
      <div className="flex-1 min-h-0 flex flex-col">
      {/* Header Section */}
      <div className="shrink-0 flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Activities</h3>
          <p className="text-sm text-gray-500">
            Activities for: {objectiveTitle}
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="bg-primary hover:bg-primary">
          <Plus className="w-4 h-4 mr-2" />
          Add Task
        </Button>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No activities yet</h3>
              <p className="text-sm text-gray-500">Create your first task to get started with activities for this objective.</p>
            </div>
            <Button onClick={() => setShowAddModal(true)} className="bg-primary hover:bg-primary">
              <Plus className="w-4 h-4 mr-2" />
              Create First Task
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          <DndContext 
            collisionDetection={closestCenter} 
            onDragEnd={onDragEnd}
          >
            <div className="flex-1 min-h-0 seamless-scroll overflow-auto min-h-[200px]">
              <table className="w-full caption-bottom text-sm task-list-table">
              <TableHeader className="bg-gray-50 sticky top-0 z-20 shadow-sm">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50" style={{ width: '40px', minWidth: '40px', maxWidth: '40px' }}>
                    <span className="sr-only">Expand</span>
                  </TableHead>
                  <TableHead className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50" style={{ width: '40px', minWidth: '40px', maxWidth: '40px' }}>
                    <span className="sr-only">Check</span>
                  </TableHead>
                  <TableHead className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50" style={{ width: '250px', minWidth: '250px', maxWidth: '250px' }}>
                    Task Title
                  </TableHead>
                  <TableHead className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50" style={{ width: '120px', minWidth: '120px', maxWidth: '120px' }}>
                    PIC
                  </TableHead>
                  <TableHead className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50" style={{ width: '130px', minWidth: '130px', maxWidth: '130px' }}>
                    Due Date
                  </TableHead>
                  <TableHead className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50" style={{ width: '130px', minWidth: '130px', maxWidth: '130px' }}>
                    Finish Date
                  </TableHead>
                  <TableHead className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50" style={{ width: '90px', minWidth: '90px', maxWidth: '90px' }}>
                    Priority
                  </TableHead>
                  <TableHead className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50" style={{ width: '130px', minWidth: '130px', maxWidth: '130px' }}>
                    Status
                  </TableHead>
                  <TableHead className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50" style={{ width: '120px', minWidth: '120px', maxWidth: '120px' }}>
                    Progress
                  </TableHead>
                  <TableHead className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50" style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }}>
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
                <TableBody>
          {tasks.map((task) => (
                    <React.Fragment key={task.id}>
                      <TableRow className="w-full hover:bg-gray-50">
                        {/* Expand/Collapse Button */}
                        <TableCell className="px-2 py-3 text-left" style={{ width: '40px', minWidth: '40px', maxWidth: '40px' }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleTaskExpansion(task.id)}
                            className="h-7 w-7 p-0 hover:bg-gray-200"
                          >
                            {expandedTasks.has(task.id) ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </Button>
                        </TableCell>

                        {/* Checkbox - green only when all steps are done (progress 100%) */}
                        <TableCell className="px-2 py-3 text-left" style={{ width: '40px', minWidth: '40px', maxWidth: '40px' }}>
                          <button
                            onClick={() => handleStatusToggle(task.id, task.status)}
                            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            {isTaskFullyCompleteBySteps(task) ? (
                              <CheckSquare className="w-5 h-5 text-primary" />
                            ) : (
                              <Square className="w-5 h-5" />
                            )}
                          </button>
                        </TableCell>

                        {/* Task Title - strikethrough only when all steps are done */}
                        <TableCell className="px-2 py-3 text-left" style={{ width: '250px', minWidth: '250px', maxWidth: '250px' }}>
                          <div 
                            className={`cursor-pointer text-sm font-medium hover:text-primary ${
                              isTaskFullyCompleteBySteps(task) ? 'line-through text-gray-500' : 'text-gray-900'
                            }`}
                            onClick={() => toggleTaskExpansion(task.id)}
                            title="Click to expand"
                          >
                            {task.title}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            {task.steps.length > 0 && (
                              <div className="flex items-center gap-1">
                                <CheckSquare className="w-3 h-3" />
                                {task.steps.filter(s => s.is_completed).length}/{task.steps.length} steps
                              </div>
                            )}
                          </div>
                        </TableCell>
                        {/* PIC (Person In Charge) */}
                        <TableCell className="px-2 py-3 text-left" style={{ width: '120px', minWidth: '120px', maxWidth: '120px' }}>
                          <div className="flex items-center">
                            {task.assigned_to_name ? (
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-primary" />
                                <span className="text-sm text-gray-900 font-medium">
                                  {task.assigned_to_name}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400 italic">
                                Unassigned
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Due Date */}
                        <TableCell className="px-2 py-3 text-left" style={{ width: '130px', minWidth: '130px', maxWidth: '130px' }}>
                          {task.due_date ? (
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span className="text-sm">{new Date(task.due_date).toLocaleDateString()}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-gray-400">
                              <Calendar className="w-3 h-3" />
                              <span className="text-sm">Set date</span>
                            </div>
                          )}
                        </TableCell>

                        {/* Finish Date */}
                        <TableCell className="px-2 py-3 text-left" style={{ width: '130px', minWidth: '130px', maxWidth: '130px' }}>
                          {task.finish_date ? (
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-primary" />
                                <span className="text-sm text-primary font-medium">
                                  {new Date(task.finish_date).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="px-2 py-3 text-left" style={{ width: '90px', minWidth: '90px', maxWidth: '90px' }}>
                          {getPriorityBadge(task.priority)}
                        </TableCell>
                        <TableCell className="px-2 py-3 text-left" style={{ width: '130px', minWidth: '130px', maxWidth: '130px' }}>
                          {getStatusBadge(isTaskFullyCompleteBySteps(task) ? 'completed' : (task.progress_percentage > 0 ? 'in_progress' : task.status))}
                        </TableCell>
                        {/* Progress */}
                        <TableCell className="px-2 py-3 text-left" style={{ width: '120px', minWidth: '120px', maxWidth: '120px' }}>
                          <div className="flex flex-col gap-1">
                            <div className="text-xs text-gray-500">
                              {task.steps.length > 0 ? `${task.progress_percentage}%` : 'No steps'}
                </div>
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div 
                                className={`h-1.5 rounded-full transition-all duration-300 ${
                                  task.progress_percentage === 100 ? 'bg-primary' : 'bg-primary/70'
                                }`}
                                style={{ width: `${task.steps.length > 0 ? task.progress_percentage : 0}%` }}
                              />
                </div>
              </div>
                        </TableCell>
                        {/* Actions */}
                        <TableCell className="px-2 py-3 text-left" style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }}>
                          <div className="flex items-center gap-1">
                            {/* Edit */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingTask(task.id)}
                              className="h-7 w-7 p-0 hover:bg-accent hover:text-primary"
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            
                            {/* Delete */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteTask(task.id)}
                              className="h-7 w-7 p-0 hover:bg-warning-muted hover:text-brand-accent"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      
                      {/* Expanded Content Row */}
                      {expandedTasks.has(task.id) && (
                        <TableRow>
                          <TableCell colSpan={10} className="w-full border-t border-primary/20 bg-info-muted px-4 py-4" style={{ minWidth: 0, maxWidth: '100%' }}>
                            {task.description && (
                              <div className="mb-4 min-w-0">
                                <h4 className="text-xs font-medium text-gray-700 mb-1">Description</h4>
                                <div className="max-h-48 overflow-y-auto seamless-scroll">
                                  <p className="text-sm text-gray-600 break-words whitespace-pre-wrap overflow-wrap-anywhere" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{task.description}</p>
                                </div>
                              </div>
                            )}
                            
                            <div className="w-full space-y-4">
                              {/* Steps Section */}
                              <div>
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                    <CheckSquare className="h-4 w-4 text-primary" />
                                    Steps ({task.steps.filter(s => s.is_completed).length}/{task.steps.length})
                                  </h4>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setAddStepDialog({ isOpen: true, taskId: task.id, taskTitle: task.title });
                                    }}
                                    className="text-primary hover:bg-accent hover:text-primary"
                                    title="Add a new step to this task"
                                  >
                                    <Plus className="w-4 h-4 mr-1" />
                                    Add Step
                                  </Button>
                                </div>
                                <SortableContext 
                                  items={task.steps.map(step => `step-${step.id}`)} 
                                  strategy={verticalListSortingStrategy}
                                >
                                  <div className="space-y-2 min-h-[50px]">
                                    {task.steps.length === 0 ? (
                                      <div className="rounded-lg border border-primary/20 bg-card p-4 text-center">
                                        <CheckSquare className="mx-auto mb-2 h-8 w-8 text-primary/60" />
                                        <p className="mb-1 text-sm font-medium text-foreground">No steps yet</p>
                                        <p className="text-xs text-muted-foreground">
                                          Break down this task into smaller steps for better tracking
                                        </p>
                                      </div>
                                    ) : (
                                      task.steps
                                        .sort((a, b) => a.order - b.order)
                                        .map((step, index) => (
                  <TaskStep
                    key={step.id}
                    autoReorder={true}
                    step={{
                      id: step.id,
                      task_id: step.task_id,
                      title: step.title,
                      is_completed: step.is_completed,
                      order: step.order,
                      created_at: step.created_at,
                      assigned_to: step.assigned_to,
                      assigned_at: step.assigned_at,
                      assigned_by: step.assigned_by,
                      files: step.files,
                      assigned_employee: step.assigned_employee,
                      assigned_by_employee: step.assigned_by_employee
                    }}
                    index={index}
                  />
                                        ))
                                    )}
                                  </div>
                                </SortableContext>
              </div>
            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
          ))}
                </TableBody>
            </table>
            </div>
          </DndContext>
        </div>
      )}


      {/* Add Task Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Task</DialogTitle>
            <DialogDescription>
              Create a new task for this objective. Fill in the details below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Enter task title"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                value={newTaskDescription}
                onChange={(e) => setNewTaskDescription(e.target.value)}
                placeholder="Enter task description"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Priority</label>
              <select
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value as 'low' | 'medium' | 'high')}
                className="w-full p-2 border rounded-md"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Due Date</label>
              <Input
                type="date"
                value={newTaskDueDate}
                onChange={(e) => setNewTaskDueDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={createTask} disabled={!newTaskTitle.trim()}>
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Step Dialog */}
      {showAssignDialog && selectedStep && (
        <AssignStepDialog
          step={{
            id: selectedStep.id,
            title: selectedStep.title,
            assigned_to: selectedStep.assigned_to,
            assigned_employee: selectedStep.assigned_employee
          }}
          onAssign={handleAssignStep}
          onUnassign={handleUnassignStep}
          onClose={() => {
            setShowAssignDialog(false);
            setSelectedStep(null);
          }}
        />
      )}

      {/* Add Step Modal */}
      {addStepDialog.taskId && (
        <AddStepModal
          open={addStepDialog.isOpen}
          onOpenChange={(open) => setAddStepDialog({ isOpen: open, taskId: null, taskTitle: '' })}
          taskId={addStepDialog.taskId}
          taskTitle={addStepDialog.taskTitle}
          onAddStep={addTaskStep}
          onSuccess={() => {
            // Refresh tasks after adding step
            fetchTasks();
          }}
        />
      )}
      </div>
    </MeetingNotesProvider>
  );
};

