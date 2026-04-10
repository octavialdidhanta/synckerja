import React, { useState, useEffect, useMemo } from 'react';
import { Users, Search, Calendar } from 'lucide-react';
import { Button } from '@/features/ui/button';
import { Input } from '@/features/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/features/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/features/ui/use-toast';
import { logger } from '@/config/logger';
import { useCurrentOrg } from '@/features/1-login/hooks/useCurrentOrg';
import { useAvailableEmployees } from '@/features/share/hooks/useAvailableEmployees';
import { useCentralizedUserData } from '@/features/1-login/contexts/CentralizedUserDataContext';
import { useIsMobile } from '@/mobile/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface Employee {
  id: string;
  full_name: string;
  email?: string;
  status?: string;
}

interface MobileAssignInitiativeItemDialogProps {
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

export const MobileAssignInitiativeItemDialog: React.FC<MobileAssignInitiativeItemDialogProps> = ({
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
  const { data: employees = [], isLoading: loading } = useAvailableEmployees();
  const { userRole, isOwner, isAdmin } = useCentralizedUserData();
  const isMobile = useIsMobile();

  // Check if user can assign employees (not employee role)
  const canAssignEmployees = isOwner || isAdmin || userRole === 'hr';

  // Use useMemo to filter employees - prevents infinite loop
  const filteredEmployees = useMemo(() => {
    if (!employees || employees.length === 0) return [];
    if (searchTerm.trim() === '') return employees;
    return employees.filter(emp =>
      emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, employees]);

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
      logger.error('Error assigning task:', error);
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
      <DialogContent
        className={cn(
          'w-full max-w-none m-0 rounded-none translate-x-0 translate-y-0 flex flex-col p-0 gap-0',
          isMobile
            ? 'fixed left-0 right-0 top-0 modal-above-safe-area'
            : 'h-full max-h-screen fixed inset-0 sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:max-w-md sm:h-auto sm:max-h-[90vh]'
        )}
        fullscreenAnimation={isMobile}
        hideCloseButton={isMobile}
      >
        <DialogHeader className="flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-left safe-area-top px-4 pt-4 pb-3">
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <span className="lowercase truncate">Assign {getItemTypeLabel()}: {item.title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll px-6 pt-4 pb-6">
          {/* Item Info */}
          <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
            <div className="text-xs font-medium text-gray-500 mb-1">
              {getItemTypeLabel()}
            </div>
            <div className="text-sm font-medium text-gray-900 line-clamp-2">
              {item.title}
            </div>
            {(item.taskTitle || item.parentStepTitle) && (
              <div className="text-xs text-gray-500 mt-1">
                {item.taskTitle && <span>{item.taskTitle}</span>}
                {item.parentStepTitle && <span> → {item.parentStepTitle}</span>}
              </div>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 text-sm"
            />
          </div>

          {/* Employee List */}
          <div className="max-h-60 overflow-y-auto space-y-2">
            {loading ? (
              <div className="text-center py-4">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
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
                  className={`p-3 border rounded-md cursor-pointer transition-colors ${
                    employee.id === selectedEmployee
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-white border-gray-200 hover:bg-blue-50 hover:border-blue-200'
                  }`}
                  onClick={() => setSelectedEmployee(employee.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{employee.full_name}</p>
                      {employee.email && (
                        <p className="text-xs text-gray-500">{employee.email}</p>
                      )}
                    </div>
                    {employee.id === selectedEmployee && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Deadline Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              Deadline (Optional)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full text-sm"
              />
              <Input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full text-sm"
              />
            </div>
            {dueDate && (
              <p className="text-xs text-gray-500">
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

        {/* Footer - rules: px-4 pt-3 pb-3, no safe-area-padding-bottom, two-layer, size="sm", primary default, loading spinner */}
        <div className="px-4 pt-3 pb-3 flex-shrink-0 border-t bg-muted/30">
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isAssigning}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAssign}
              disabled={!selectedEmployee || isAssigning || (dueDate && !isValidDate)}
              className="min-w-[120px] flex items-center justify-center gap-1.5 w-full sm:w-auto"
            >
              {isAssigning ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Assigning...</span>
                </>
              ) : (
                <>
                  <Users className="w-4 h-4" />
                  Assign
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

