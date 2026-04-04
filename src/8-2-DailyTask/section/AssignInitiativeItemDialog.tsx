import React, { useState, useEffect, useMemo } from 'react';
import { Users, Search, Calendar, Clock } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/components/ui/dialog';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/components/ui/use-toast';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useAvailableEmployees } from '@/shared/hooks/useAvailableEmployees';
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';

interface Employee {
  id: string;
  full_name: string;
  email?: string;
  status?: string;
}

interface AssignInitiativeItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: {
    id: string;
    type: 'task' | 'step' | 'substep';
    title: string;
    taskTitle?: string;
    parentStepTitle?: string;
  } | null;
  onAssign: () => void;
}

export const AssignInitiativeItemDialog: React.FC<AssignInitiativeItemDialogProps> = ({
  open,
  onOpenChange,
  item,
  onAssign
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [dueTime, setDueTime] = useState<string>('23:59');
  const [isAssigning, setIsAssigning] = useState(false);
  const { toast } = useToast();
  const { organizationId } = useCurrentOrg();
  const { data: employeesData, isLoading: loading } = useAvailableEmployees();
  const { userRole, isOwner, isAdmin } = useCentralizedUserData();

  // Stable reference: avoid new [] on every render when data is undefined (prevents infinite loop)
  const employees = employeesData ?? null;
  const employeesList = employees ?? [];

  // Derive filtered list with useMemo instead of useEffect+state to avoid "Maximum update depth" loop
  const filteredEmployees = useMemo(() => {
    if (searchTerm.trim() === '') return employeesList;
    const term = searchTerm.toLowerCase();
    return employeesList.filter(
      (emp) =>
        emp.full_name?.toLowerCase().includes(term) ||
        emp.email?.toLowerCase().includes(term)
    );
  }, [searchTerm, employeesList]);

  // Check if user can assign employees (not employee role)
  const canAssignEmployees = isOwner || isAdmin || userRole === 'hr';

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSearchTerm('');
      setSelectedEmployee('');
      setDueDate('');
      setDueTime('23:59');
    }
  }, [open]);

  const handleAssign = async () => {
    if (!canAssignEmployees) {
      toast({
        title: 'Permission Denied',
        description: 'Only Admin, Owner, or HR can assign employees',
        variant: 'destructive'
      });
      return;
    }

    if (!item || !selectedEmployee || !organizationId) {
      toast({
        title: 'Error',
        description: 'Please select an employee',
        variant: 'destructive'
      });
      return;
    }

    setIsAssigning(true);
    try {
      let assignmentId: string | null = null;

      // Combine date and time for deadline
      const deadline = dueDate ? `${dueDate}T${dueTime}:00` : null;
      const deadlineIso = deadline ? new Date(deadline).toISOString() : null;

      if (item.type === 'task') {
        // Delete existing assignments first
        await supabase
          .from('daily_tasks_assigned')
          .delete()
          .eq('daily_task_id', item.id);

        // Create new task assignment
        const { data: taskAssignmentData, error: taskAssignError } = await supabase
          .from('daily_tasks_assigned')
          .insert({
            organization_id: organizationId,
            daily_task_id: item.id,
            employee_id: selectedEmployee,
            assigned_by: selectedEmployee, // Self-assignment for now
            assigned_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (taskAssignError) throw taskAssignError;
        assignmentId = taskAssignmentData?.id;
      } else if (item.type === 'step') {
        // Delete existing assignments first
        await supabase
          .from('task_steps_assigned')
          .delete()
          .eq('task_step_id', item.id);

        // Assign step to employee
        const { data: assignmentData, error: assignError } = await supabase
          .from('task_steps_assigned')
          .insert({
            organization_id: organizationId,
            task_step_id: item.id,
            employee_id: selectedEmployee,
            assigned_by: selectedEmployee,
            assigned_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (assignError) throw assignError;
        assignmentId = assignmentData?.id;
      } else if (item.type === 'substep') {
        // Delete existing substep assignments first
        await supabase
          .from('task_steps_to_steps_assigned')
          .delete()
          .eq('task_steps_to_steps_id', item.id);

        // Create substep assignment
        const { data: substepAssignmentData, error: substepAssignError } = await supabase
          .from('task_steps_to_steps_assigned')
          .insert({
            organization_id: organizationId,
            task_steps_to_steps_id: item.id,
            employee_id: selectedEmployee,
            assigned_by: selectedEmployee,
            assigned_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (substepAssignError) throw substepAssignError;
        assignmentId = substepAssignmentData?.id;
      }

      // Save due date if provided
      if (assignmentId && deadlineIso) {
        const dueDatePayload: any = {
          organization_id: organizationId,
          due_date: deadlineIso
        };

        if (item.type === 'task') {
          dueDatePayload.daily_tasks_assigned_id = assignmentId;
        } else if (item.type === 'step') {
          dueDatePayload.task_steps_assigned_id = assignmentId;
        } else if (item.type === 'substep') {
          dueDatePayload.task_steps_to_steps_assigned_id = assignmentId;
        }

        await supabase
          .from('task_steps_assigned_duedate')
          .insert(dueDatePayload);
      }

      toast({
        title: 'Success',
        description: 'Task assigned successfully'
      });

      onAssign();
      onOpenChange(false);
    } catch (error) {
      console.error('Error assigning task:', error);
      toast({
        title: 'Error',
        description: 'Failed to assign task',
        variant: 'destructive'
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const getItemTypeLabel = () => {
    if (!item) return 'Item';
    switch (item.type) {
      case 'task': return 'Task';
      case 'step': return 'Step';
      case 'substep': return 'Sub-Step';
      default: return 'Item';
    }
  };

  const isValidDate = dueDate && new Date(dueDate) >= new Date(new Date().setHours(0, 0, 0, 0));

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-auto max-h-[min(560px,92vh)] w-full max-w-[520px] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b bg-gradient-to-r from-primary/5 to-primary/10 px-6 pb-4 pt-6 pr-14 dark:from-primary/10 dark:to-primary/5 sm:pr-16">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 dark:bg-primary/20">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-xl font-semibold leading-tight">
                <span className="line-clamp-2">Assign {getItemTypeLabel()}</span>
              </DialogTitle>
              <DialogDescription className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                Assign this {getItemTypeLabel().toLowerCase()} and optionally add a deadline.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto px-6 py-4">
          <div className="min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="mb-1 text-xs font-medium text-gray-500">
              {getItemTypeLabel()}
            </div>
            <div className="break-words text-sm font-medium text-gray-900">
              {item.title}
            </div>
            {(item.taskTitle || item.parentStepTitle) && (
              <div className="mt-1 min-w-0 break-words text-xs text-gray-500">
                {item.taskTitle && <span>{item.taskTitle}</span>}
                {item.parentStepTitle && <span> → {item.parentStepTitle}</span>}
              </div>
            )}
          </div>

          {/* Search */}
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="min-w-0 pl-10 focus-visible:border-primary focus-visible:ring-primary"
            />
          </div>

          {/* Employee List */}
          <div className="min-h-0 min-w-0 max-h-[min(240px,35vh)] space-y-2 overflow-x-hidden overflow-y-auto">
            {loading ? (
              <div className="text-center py-4">
                <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm text-gray-500 mt-2">Loading employees...</p>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="text-center py-4">
                <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No employees found</p>
              </div>
            ) : (
              filteredEmployees.map((employee) => (
                <div
                  key={employee.id}
                  className={`min-w-0 cursor-pointer rounded-md border p-3 transition-colors ${
                    employee.id === selectedEmployee
                      ? 'border-primary/30 bg-primary/10'
                      : 'border-gray-200 bg-white hover:border-primary/25 hover:bg-primary/5'
                  }`}
                  onClick={() => setSelectedEmployee(employee.id)}
                >
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{employee.full_name}</p>
                      {employee.email && (
                        <p className="truncate text-xs text-gray-500">{employee.email}</p>
                      )}
                    </div>
                    {employee.id === selectedEmployee && (
                      <div className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Deadline Selection */}
          <div className="min-w-0 space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Calendar className="h-4 w-4 shrink-0 text-primary" />
              Deadline (Optional)
            </label>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="min-w-0 w-full max-w-full focus-visible:border-primary focus-visible:ring-primary"
              />
              <Input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="min-w-0 w-full max-w-full focus-visible:border-primary focus-visible:ring-primary"
              />
            </div>
            {dueDate && (
              <p className="break-words text-xs text-gray-500">
                Due: {new Date(`${dueDate}T${dueTime}`).toLocaleString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 flex-row justify-end gap-3 border-t bg-muted/30 px-6 pb-6 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isAssigning}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedEmployee || isAssigning || (dueDate && !isValidDate)}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isAssigning ? (
              <>
                <span className="mr-2">⏳</span>
                Assigning...
              </>
            ) : (
              <>
                <Users className="w-4 h-4 mr-2" />
                Assign
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


