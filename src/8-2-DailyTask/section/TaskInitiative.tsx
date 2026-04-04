import React, { useState, useEffect, useCallback } from 'react';
import { Target, CheckCircle, Clock, User, ChevronRight, Loader2 } from 'lucide-react';
import { useDailyTask } from '../context/DailyTaskContext';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useToast } from '@/shared/components/ui/use-toast';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { DueDateDialog } from './DueDateDialog';
import { AssignInitiativeItemDialog } from './AssignInitiativeItemDialog';
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';
import { formatDateTime } from '@/shared/utils/dateFormatter';
import { ModalViewSubSteps } from './ModalViewSubSteps';

// Export stats for parent component
export interface InitiativeStats {
  totalItems: number;
  unassignedItems: number;
}

interface UncompletedItem {
  id: string;
  type: 'task' | 'step' | 'substep';
  title: string;
  taskTitle?: string;
  parentStepTitle?: string;
  taskId?: string;
  parentStepId?: string;
  priority?: string;
  dueDate?: string | null;
  assignedTo?: string | null;
  assignedEmployee?: { full_name: string; email: string } | null;
  assignedAt?: string | null; // Assignment date/time
  created_at: string;
}

interface TaskInitiativeProps {
  onStatsChange?: (stats: InitiativeStats) => void;
}

const TaskInitiative: React.FC<TaskInitiativeProps> = ({ onStatsChange }) => {
  const { 
    tasks, 
    filteredTasks,
    isLoading: tasksLoading,
    setFilters,
    setExpandedTasks,
    navigateToTask,
    scrollToStep
  } = useDailyTask();
  const { organizationId } = useCurrentOrg();
  const { toast } = useToast();
  const { userRole, isOwner, isAdmin } = useCentralizedUserData();
  
  // Check if user can assign employees (not employee role)
  const canAssignEmployees = isOwner || isAdmin || userRole === 'hr';
  const [uncompletedItems, setUncompletedItems] = useState<UncompletedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [takingTask, setTakingTask] = useState<string | null>(null);
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string | null>(null);
  const [showDueDateDialog, setShowDueDateDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<UncompletedItem | null>(null);
  const [selectedItemForAssign, setSelectedItemForAssign] = useState<UncompletedItem | null>(null);
  const [subStepModal, setSubStepModal] = useState<{
    open: boolean;
    parentStepId: string;
    parentStepTitle: string;
  }>({
    open: false,
    parentStepId: '',
    parentStepTitle: '',
  });
  const handleItemNavigation = useCallback((item: UncompletedItem) => {
    if (!item || !item.title) return;

    if (item.type === 'task') {
      setFilters(prev => ({ ...prev, search: item.title }));
      navigateToTask(item.id);
      return;
    }

    if (item.type === 'step') {
      setFilters(prev => ({ ...prev, search: item.title }));
      if (item.taskId) {
        setExpandedTasks(prev => new Set([...prev, item.taskId]));
        navigateToTask(item.taskId);
        setTimeout(() => scrollToStep(item.id), 250);
      }
      return;
    }

    if (item.type === 'substep') {
      const searchValue = item.parentStepTitle || item.title;
      setFilters(prev => ({ ...prev, search: searchValue }));

      if (item.taskId) {
        setExpandedTasks(prev => new Set([...prev, item.taskId]));
        navigateToTask(item.taskId);
      }

      if (item.parentStepId) {
        setSubStepModal({
          open: true,
          parentStepId: item.parentStepId,
          parentStepTitle: item.parentStepTitle || item.title,
        });
        setTimeout(() => {
          scrollToStep(item.parentStepId as string);
        }, 250);
      }
    }
  }, [navigateToTask, scrollToStep, setExpandedTasks, setFilters]);


  // Get current employee ID
  useEffect(() => {
    let cancelled = false;
    const fetchCurrentEmployee = async () => {
      try {
        // Get authenticated user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (cancelled) return;
        if (userError) {
          console.error('Error getting user:', userError);
          return;
        }
        if (!user) {
          console.log('No authenticated user found');
          return;
        }
        if (!organizationId) {
          console.log('Waiting for organization ID...');
          return;
        }

        // Get employee record with organization context
        const { data: employee, error: employeeError } = await supabase
          .from('employees')
          .select('id')
          .eq('user_id', user.id)
          .eq('organization_id', organizationId)
          .maybeSingle(); // Use maybeSingle() to avoid error if no record found
        if (cancelled) return;
        if (employeeError) {
          console.error('Error fetching employee:', employeeError);
          return;
        }
        if (employee) {
          setCurrentEmployeeId(employee.id);
          console.log('✅ Current employee ID loaded:', employee.id);
        } else {
          console.warn('⚠️ No employee record found for current user in this organization');
          toast({
            title: 'Profile Not Found',
            description: 'Your employee profile is not found in this organization. Please contact admin.',
            variant: 'destructive'
          });
        }
      } catch (error) {
        if (cancelled) return;
        console.error('Error fetching current employee:', error);
        toast({
          title: 'Error',
          description: 'Could not load your profile',
          variant: 'destructive',
        });
      }
    };

    fetchCurrentEmployee();
    return () => { cancelled = true; };
  }, [organizationId, toast]); // Re-fetch when organization changes

  // Function to fetch uncompleted items (can be called to refresh)
  const fetchUncompletedItems = useCallback(async () => {
    if (!organizationId) return;
    
    setIsLoading(true);
    try {
      const items: UncompletedItem[] = [];

        // 1. Fetch ALL uncompleted tasks from daily_tasks (no limit)
        // EXCLUDE tasks that have steps (has_substeps = true)
        const { data: incompleteTasks } = await supabase
          .from('daily_tasks')
          .select(`
            id,
            title,
            priority,
            due_date,
            created_at,
            status,
            has_substeps,
            daily_tasks_assigned(
              id,
              employee_id,
              assigned_at,
              employee:employees!employee_id(full_name, email)
            )
          `)
          .eq('organization_id', organizationId)
          .neq('status', 'completed')
          .neq('status', 'cancelled')
          .eq('has_substeps', false)
          .order('created_at', { ascending: false });

        if (incompleteTasks) {
          // Fetch due dates for all task assignments
          const taskAssignmentIds = incompleteTasks
            .map((t: any) => t.daily_tasks_assigned?.[0]?.id)
            .filter(Boolean);

          let taskDueDatesMap: Record<string, string> = {};
          if (taskAssignmentIds.length > 0) {
            const { data: taskDueDates } = await supabase
              .from('task_steps_assigned_duedate')
              .select('daily_tasks_assigned_id, due_date')
              .in('daily_tasks_assigned_id', taskAssignmentIds)
              .order('created_at', { ascending: false });

            if (taskDueDates) {
              taskDueDates.forEach((dd: any) => {
                taskDueDatesMap[dd.daily_tasks_assigned_id] = dd.due_date;
              });
            }
          }

          incompleteTasks.forEach((task: any) => {
            const assignment = task.daily_tasks_assigned?.[0];
            items.push({
              id: task.id,
              type: 'task',
              title: task.title,
              priority: task.priority,
              dueDate: assignment?.id ? taskDueDatesMap[assignment.id] : task.due_date, // Prioritize assignment due date, fallback to task due_date
              assignedTo: assignment?.employee_id,
              assignedEmployee: assignment?.employee,
              assignedAt: assignment?.assigned_at || null,
              created_at: task.created_at
            });
          });
        }

        // 2. Fetch ALL uncompleted steps from task_steps (no limit)
        // EXCLUDE steps that have sub-steps (has_substeps = true)
        const { data: incompleteSteps } = await supabase
          .from('task_steps')
          .select(`
            id,
            title,
            created_at,
            task_id,
            is_completed,
            has_substeps,
            daily_tasks!inner(
              id,
              title,
              organization_id,
              priority,
              status
            ),
            task_steps_assigned(
              id,
              employee_id,
              assigned_at,
              employee:employees!employee_id(full_name, email)
            )
          `)
          .eq('daily_tasks.organization_id', organizationId)
          .eq('is_completed', false)
          .eq('has_substeps', false)
          .neq('daily_tasks.status', 'cancelled')
          .order('created_at', { ascending: false });

        if (incompleteSteps) {
          // Fetch due dates for all step assignments
          const stepAssignmentIds = incompleteSteps
            .map((s: any) => s.task_steps_assigned?.[0]?.id)
            .filter(Boolean);

          let dueDatesMap: Record<string, string> = {};
          if (stepAssignmentIds.length > 0) {
            const { data: dueDates } = await supabase
              .from('task_steps_assigned_duedate')
              .select('task_steps_assigned_id, due_date')
              .in('task_steps_assigned_id', stepAssignmentIds)
              .order('created_at', { ascending: false });

            if (dueDates) {
              dueDates.forEach((dd: any) => {
                dueDatesMap[dd.task_steps_assigned_id] = dd.due_date;
              });
            }
          }

          incompleteSteps.forEach((step: any) => {
            const assignment = step.task_steps_assigned?.[0];
            items.push({
              id: step.id,
              type: 'step',
              title: step.title,
              taskTitle: step.daily_tasks?.title,
              taskId: step.task_id,
              priority: step.daily_tasks?.priority,
              assignedTo: assignment?.employee_id,
              assignedEmployee: assignment?.employee,
              assignedAt: assignment?.assigned_at || null,
              dueDate: assignment?.id ? dueDatesMap[assignment.id] : null,
              created_at: step.created_at
            });
          });
        }

        // 3. Fetch uncompleted sub-steps from task_steps_to_steps with assignment info
        try {
          const { data: incompleteSubSteps, error: subStepError } = await supabase
            .from('task_steps_to_steps')
            .select(`
              id,
              title,
              created_at,
              parent_step_id,
              is_completed,
              task_steps_to_steps_assigned(
                id,
                employee_id,
                assigned_at,
                employee:employees!employee_id(full_name, email)
              )
            `)
            .eq('organization_id', organizationId)
            .eq('is_completed', false)
            .order('created_at', { ascending: false });

          if (subStepError) {
            console.error('Error fetching sub-steps:', subStepError);
          } else if (incompleteSubSteps) {
            // Only log summary, not each item (performance optimization)
            if (import.meta.env.DEV) {
              console.log('📊 Fetched substeps:', incompleteSubSteps.length);
            }
            
            // Fetch due dates for all substep assignments
            const substepAssignmentIds = incompleteSubSteps
              .map((s: any) => s.task_steps_to_steps_assigned?.[0]?.id)
              .filter(Boolean);

            let substepDueDatesMap: Record<string, string> = {};
            if (substepAssignmentIds.length > 0) {
              const { data: substepDueDates } = await supabase
                .from('task_steps_assigned_duedate')
                .select('task_steps_to_steps_assigned_id, due_date')
                .in('task_steps_to_steps_assigned_id', substepAssignmentIds)
                .order('created_at', { ascending: false });

              if (substepDueDates) {
                substepDueDates.forEach((dd: any) => {
                  substepDueDatesMap[dd.task_steps_to_steps_assigned_id] = dd.due_date;
                });
              }
            }
            
            // Get parent step info for each sub-step
            for (const substep of incompleteSubSteps) {
              try {
                const { data: parentStep } = await supabase
                  .from('task_steps')
                  .select(`
                    id,
                    title,
                    task_id,
                    daily_tasks!inner(
                      id,
                      title,
                      priority,
                      status
                    )
                  `)
                  .eq('id', (substep as any).parent_step_id)
                  .single();

                if (parentStep && (parentStep as any).daily_tasks?.status !== 'cancelled') {
                  const assignment = (substep as any).task_steps_to_steps_assigned?.[0];
                  items.push({
                    id: (substep as any).id,
                    type: 'substep',
                    title: (substep as any).title,
                    parentStepTitle: (parentStep as any).title,
                    taskTitle: (parentStep as any).daily_tasks?.title,
                    taskId: (parentStep as any).task_id,
                    parentStepId: (substep as any).parent_step_id,
                    priority: (parentStep as any).daily_tasks?.priority,
                    assignedTo: assignment?.employee_id,
                    assignedEmployee: assignment?.employee,
                    assignedAt: assignment?.assigned_at || null,
                    dueDate: assignment?.id ? substepDueDatesMap[assignment.id] : null,
                    created_at: (substep as any).created_at
                  });
                }
              } catch (err) {
                // Skip this substep if there's an error
                console.error('Error fetching parent step:', err);
              }
            }
          }
        } catch (err) {
          console.error('Error in sub-steps fetch:', err);
        }

        // Sort by created_at (newest first)
        items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setUncompletedItems(items);
    } catch (error) {
      console.error('Error fetching uncompleted items:', error);
        toast({
          title: 'Error',
          description: 'Failed to load uncompleted tasks',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
  }, [organizationId, tasksLoading, tasks, onStatsChange, toast]);

  // Show only items whose task is in the current filter set
  const displayItems = React.useMemo(() => {
    const filteredIds = new Set((filteredTasks || []).map((t) => t.id));
    return (uncompletedItems || []).filter((item) =>
      item.type === 'task'
        ? filteredIds.has(item.id)
        : !!(item.taskId && filteredIds.has(item.taskId))
    );
  }, [filteredTasks, uncompletedItems]);

  // Notify parent of filter-aware stats
  useEffect(() => {
    if (onStatsChange) {
      onStatsChange({
        totalItems: displayItems.length,
        unassignedItems: displayItems.filter((item) => !item.assignedTo).length,
      });
    }
  }, [displayItems, onStatsChange]);

  // Fetch uncompleted items on mount and when dependencies change
  useEffect(() => {
    fetchUncompletedItems();
  }, [fetchUncompletedItems]);

  // Take task: due date dialog then assign to self. Reassign: open assign dialog for admin/HR to assign to another employee.
  const handleTakeTaskClick = (item: UncompletedItem) => {
    if (item.assignedTo && item.assignedTo !== currentEmployeeId) {
      setSelectedItemForAssign(item);
      setShowAssignDialog(true);
    } else {
      setSelectedItem(item);
      setShowDueDateDialog(true);
    }
  };

  // Handle actual task assignment with due date
  const handleTakeTaskWithDueDate = async (dueDate: string) => {
    if (!selectedItem || !currentEmployeeId || !organizationId) {
      toast({
        title: 'Error',
        description: 'Unable to identify current employee or organization',
        variant: 'destructive'
      });
      return;
    }

    setTakingTask(selectedItem.id);

    try {
      let assignmentId: string | null = null;
      let assignmentType: 'task' | 'step' | 'substep' | null = null;

      if (selectedItem.type === 'task') {
        // Assign task to current employee using daily_tasks_assigned table
        if (!currentEmployeeId) {
          throw new Error('Current employee ID is required for task assignment');
        }

        // Delete existing assignments first (keep only latest)
        await supabase
          .from('daily_tasks_assigned')
          .delete()
          .eq('daily_task_id', selectedItem.id);

        // Create new task assignment
        const { data: taskAssignmentData, error: taskAssignError } = await supabase
          .from('daily_tasks_assigned')
          .insert({
            organization_id: organizationId,
            daily_task_id: selectedItem.id,
            employee_id: currentEmployeeId,
            assigned_by: currentEmployeeId, // Self-assignment
            assigned_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (taskAssignError) throw taskAssignError;

        assignmentId = taskAssignmentData?.id;
        assignmentType = 'task';

        toast({
          title: 'Success',
          description: 'Task assigned to you successfully'
        });
      } else if (selectedItem.type === 'step') {
        // Validate currentEmployeeId before assignment
        if (!currentEmployeeId) {
          throw new Error('Current employee ID is required for step assignment');
        }

        // Delete existing assignments first
        await supabase
          .from('task_steps_assigned')
          .delete()
          .eq('task_step_id', selectedItem.id);

        // Assign step to current employee
        const { data: assignmentData, error: assignError } = await supabase
          .from('task_steps_assigned')
          .insert({
            organization_id: organizationId,
            task_step_id: selectedItem.id,
            employee_id: currentEmployeeId,
            assigned_by: currentEmployeeId, // REQUIRED: User who assigns (self in this case)
            assigned_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (assignError) throw assignError;

        assignmentId = assignmentData?.id;
        assignmentType = 'step';

        toast({
          title: 'Success',
          description: 'Step assigned to you successfully'
        });
      } else if (selectedItem.type === 'substep') {
        // For sub-steps, create assignment in task_steps_to_steps_assigned
        if (!currentEmployeeId) {
          throw new Error('Current employee ID is required for substep assignment');
        }

        // Delete existing substep assignments first (keep only latest)
        await supabase
          .from('task_steps_to_steps_assigned')
          .delete()
          .eq('task_steps_to_steps_id', selectedItem.id);

        // Create substep assignment
        const { data: substepAssignmentData, error: substepAssignError } = await supabase
          .from('task_steps_to_steps_assigned')
          .insert({
            organization_id: organizationId,
            task_steps_to_steps_id: selectedItem.id,
            employee_id: currentEmployeeId,
            assigned_by: currentEmployeeId, // Self-assignment
            assigned_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (substepAssignError) throw substepAssignError;

        assignmentId = substepAssignmentData?.id;
        assignmentType = 'substep';

        toast({
          title: 'Success',
          description: 'Sub-step assigned to you successfully'
        });
      }

      // Save due date to task_steps_assigned_duedate table
      if (assignmentId && assignmentType) {
        const dueDatePayload: any = {
          organization_id: organizationId,
          due_date: dueDate
        };

        if (assignmentType === 'task') {
          dueDatePayload.daily_tasks_assigned_id = assignmentId;
        } else if (assignmentType === 'step') {
          dueDatePayload.task_steps_assigned_id = assignmentId;
        } else if (assignmentType === 'substep') {
          dueDatePayload.task_steps_to_steps_assigned_id = assignmentId;
        }

        const { error: dueDateError } = await supabase
          .from('task_steps_assigned_duedate')
          .insert(dueDatePayload);

        if (dueDateError) {
          console.error('Error saving due date:', dueDateError);
          // Don't fail the whole operation if due date save fails
          toast({
            title: 'Warning',
            description: 'Assignment successful but due date could not be saved',
            variant: 'default'
          });
        }
      }

      // Close dialog and refresh the list
      setShowDueDateDialog(false);
      setSelectedItem(null);
      await fetchUncompletedItems();
    } catch (error) {
      console.error('Error taking task:', error);
      toast({
        title: 'Error',
        description: 'Failed to assign task',
        variant: 'destructive'
      });
    } finally {
      setTakingTask(null);
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'task': return <Target className="w-4 h-4" />;
      case 'step': return <CheckCircle className="w-4 h-4" />;
      case 'substep': return <ChevronRight className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'task': return 'Task';
      case 'step': return 'Step';
      case 'substep': return 'Sub-Step';
      default: return type;
    }
  };

  if (isLoading || tasksLoading) return null;

  return (
    <div className="w-full min-w-0 space-y-4">
      {/* Header Stats */}
      <div className="rounded-lg border-2 border-primary/40 bg-gradient-to-br from-primary/25 via-primary/15 to-primary/20 p-4 shadow-sm ring-1 ring-primary/15">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <h4 className="text-sm font-semibold text-foreground">Available Tasks</h4>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total Available</span>
            <span className="font-medium text-gray-900">{displayItems.length}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Unassigned</span>
            <span className="font-medium text-gray-900">
              {displayItems.filter(item => !item.assignedTo).length}
            </span>
          </div>
        </div>
      </div>

      {/* Uncompleted Items List */}
      <div className="space-y-2">
        {displayItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium">All tasks completed!</p>
            <p className="text-xs mt-1">Great job, nothing left to do.</p>
          </div>
        ) : (
          displayItems.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Type Badge and Priority */}
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">
                      {getTypeIcon(item.type)}
                      <span className="ml-1">{getTypeBadge(item.type)}</span>
                    </Badge>
                    {item.priority && (
                      <Badge variant="outline" className={`text-xs ${getPriorityColor(item.priority)}`}>
                        {item.priority}
                      </Badge>
                    )}
                  </div>

                  {/* Title */}
                  <h5 
                    className="mb-1 line-clamp-2 cursor-pointer text-sm font-semibold text-gray-900 transition-colors hover:text-primary"
                    onClick={() => handleItemNavigation(item)}
                  >
                    {item.title}
                  </h5>

                  {/* Breadcrumb */}
                  {(item.taskTitle || item.parentStepTitle) && (
                    <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                      {item.taskTitle && (
                        <>
                          <span className="truncate max-w-[120px]">{item.taskTitle}</span>
                          {item.parentStepTitle && <ChevronRight className="w-3 h-3 flex-shrink-0" />}
                        </>
                      )}
                      {item.parentStepTitle && (
                        <span className="truncate max-w-[120px]">{item.parentStepTitle}</span>
                      )}
                    </div>
                  )}

                  {/* Assigned Info */}
                  {item.assignedEmployee ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <User className="w-3 h-3" />
                        <span>Assigned to: {item.assignedEmployee.full_name}</span>
                      </div>
                      {item.assignedAt && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 ml-4">
                          <Clock className="w-3 h-3" />
                          <span>Assigned at: {formatDateTime(item.assignedAt)}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div 
                      className={`flex items-center gap-1 text-xs text-amber-600 ${
                        canAssignEmployees 
                          ? 'cursor-pointer hover:text-amber-700 transition-colors' 
                          : 'cursor-not-allowed opacity-75'
                      }`}
                      onClick={canAssignEmployees ? () => {
                        setSelectedItemForAssign(item);
                        setShowAssignDialog(true);
                      } : undefined}
                      title={!canAssignEmployees ? 'Only Admin, Owner, or HR can assign employees' : undefined}
                    >
                      <Clock className="w-3 h-3" />
                      <span>Unassigned</span>
                    </div>
                  )}

                  {/* Due Date Info */}
                  {item.dueDate && (
                    <div className="mt-1 flex items-center gap-1 text-xs font-medium text-primary">
                      <Clock className="w-3 h-3" />
                      <span>
                        Due: {new Date(item.dueDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Take Task Button */}
                <Button
                  size="sm"
                  variant={item.assignedTo ? "outline" : "default"}
                  disabled={takingTask === item.id || item.assignedTo === currentEmployeeId}
                  onClick={() => handleTakeTaskClick(item)}
                  className={
                    item.assignedTo
                      ? "flex-shrink-0 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
                      : "flex-shrink-0 bg-primary font-semibold text-primary-foreground shadow-md hover:bg-primary/90"
                  }
                >
                  {takingTask === item.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : item.assignedTo === currentEmployeeId ? (
                    'Your Task'
                  ) : item.assignedTo ? (
                    'Reassign'
                  ) : (
                    'Take Task'
                  )}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Due Date Dialog */}
      <DueDateDialog
        open={showDueDateDialog}
        onOpenChange={setShowDueDateDialog}
        onConfirm={handleTakeTaskWithDueDate}
        taskTitle={selectedItem?.title || ''}
        taskType={selectedItem?.type || 'task'}
        isLoading={takingTask === selectedItem?.id}
      />

      {/* Assign Dialog */}
      <AssignInitiativeItemDialog
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        item={selectedItemForAssign ? {
          id: selectedItemForAssign.id,
          type: selectedItemForAssign.type,
          title: selectedItemForAssign.title,
          taskTitle: selectedItemForAssign.taskTitle,
          parentStepTitle: selectedItemForAssign.parentStepTitle
        } : null}
        onAssign={fetchUncompletedItems}
      />

      <ModalViewSubSteps
        open={subStepModal.open}
        onOpenChange={(open) => setSubStepModal(prev => ({ ...prev, open }))}
        parentStepId={subStepModal.parentStepId}
        parentStepTitle={subStepModal.parentStepTitle}
      />
    </div>
  );
};

export default TaskInitiative;


