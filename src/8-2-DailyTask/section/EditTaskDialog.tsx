import React, { useState, useEffect, useMemo } from 'react';
import { X, Flag, User, Calendar, Building2, Target, Unlink } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import { useDailyTask } from '../context/DailyTaskContext';
import { DueDatePicker } from './DueDatePicker';
import { useAvailableEmployees } from '@/shared/hooks/useAvailableEmployees';
import { MonthPicker } from '@/shared/calendar';
import { format, startOfMonth } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { supabase } from '@/shared/lib/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/hooks/useCurrentOrg';
import { useOkrCycles } from '@/1-home/components/HomeOKRDashboard/hooks/useOkrCycles';
import { useIndividualObjectives } from '@/1-home/components/HomeOKRDashboard/modal/useIndividualObjectives';
import { ObjectiveHierarchyDialog } from '@/8-2-DailyTask/section/ObjectiveHierarchyDialog';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useToast } from '@/shared/components/ui/use-toast';
import { useIsMobile } from '@/mobile/hooks/use-mobile';

interface EditTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string | null;
}

export const EditTaskDialog: React.FC<EditTaskDialogProps> = ({ isOpen, onClose, taskId }) => {
  const isMobile = useIsMobile();
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { tasks, updateTask } = useDailyTask();
  const { data: employees = [] } = useAvailableEmployees();
  const { organizationId } = useCurrentOrg();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [status, setStatus] = useState('pending');
  const [dueDate, setDueDate] = useState<string>('');
  const [planDate, setPlanDate] = useState<Date | null>(null);
  const [isPlanDatePickerOpen, setIsPlanDatePickerOpen] = useState(false);
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [objectiveId, setObjectiveId] = useState<string>('');
  const [objectiveContext, setObjectiveContext] = useState<{
    companyTitle?: string;
    departmentTitle?: string;
    individualTitle: string;
  } | null>(null);
  const [isObjectiveDialogOpen, setIsObjectiveDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  const { data: cycles = [] } = useOkrCycles(organizationId);
  const activeCycleIds = useMemo(() => {
    if (planDate) {
      const planDateObj = new Date(planDate);
      const planYear = planDateObj.getFullYear();
      const planMonth = planDateObj.getMonth() + 1;
      const planMonthStart = new Date(planYear, planMonth - 1, 1, 0, 0, 0, 0);
      const planMonthEnd = new Date(planYear, planMonth, 0, 23, 59, 59, 999);
      let expectedQuarter: string | null = null;
      let expectedQuarterLower: string | null = null;
      if (planMonth >= 1 && planMonth <= 3) {
        expectedQuarter = 'Q1';
        expectedQuarterLower = 'q1';
      } else if (planMonth >= 4 && planMonth <= 6) {
        expectedQuarter = 'Q2';
        expectedQuarterLower = 'q2';
      } else if (planMonth >= 7 && planMonth <= 9) {
        expectedQuarter = 'Q3';
        expectedQuarterLower = 'q3';
      } else if (planMonth >= 10 && planMonth <= 12) {
        expectedQuarter = 'Q4';
        expectedQuarterLower = 'q4';
      }
      const filteredCycles = cycles
        .filter((cycle: any) => {
          const cyclePeriodType = cycle.period_type;
          const cycleQuarter = cycle.quarter;
          const cycleYear = cycle.year;
          const cycleStartStr = cycle.start_date;
          const cycleEndStr = cycle.end_date;
          if (!cycleStartStr || !cycleEndStr) return false;
          const [startYear, startMonth, startDay] = cycleStartStr.split('-').map(Number);
          const [endYear, endMonth, endDay] = cycleEndStr.split('-').map(Number);
          const cycleStart = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
          const cycleEnd = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);
          const overlaps = cycleStart <= planMonthEnd && cycleEnd >= planMonthStart;
          if (cyclePeriodType === 'quarterly' || cycleQuarter) {
            const quarterMatches = cycleQuarter && (
              cycleQuarter.toLowerCase() === expectedQuarterLower ||
              cycleQuarter.toUpperCase() === expectedQuarter
            );
            return cycleYear === planYear && quarterMatches && overlaps;
          }
          if (cyclePeriodType === 'yearly') return overlaps;
          return !!cyclePeriodType ? false : overlaps;
        })
        .map((c: any) => c.id);
      return filteredCycles;
    }
    const currentYear = new Date().getFullYear();
    return cycles
      .filter((c: any) => c.is_active === true || (c.year === currentYear || c.year === currentYear + 1))
      .map((c: any) => c.id);
  }, [cycles, planDate]);

  const { data: individualObjectives = [] } = useIndividualObjectives(organizationId, activeCycleIds);

  // Fetch departments
  const { data: departments = [] } = useQuery({
    queryKey: ['departments', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  // Load task data when dialog opens
  useEffect(() => {
    if (isOpen && taskId) {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        setTitle(task.title || '');
        setDescription(task.description || '');
        setPriority(task.priority || 'medium');
        setStatus(task.status || 'pending');
        setDueDate(task.due_date || '');
        setAssignedTo(task.assigned_to || '');
        // Load plan_date - convert string to Date if exists
        if (task.plan_date) {
          setPlanDate(startOfMonth(new Date(task.plan_date)));
        } else {
          setPlanDate(null);
        }
        
        // Load department_id from daily_tasks_assigned
        const loadDepartment = async () => {
          const { data: assignment } = await supabase
            .from('daily_tasks_assigned')
            .select('department_id')
            .eq('daily_task_id', taskId)
            .maybeSingle();
          
          if (assignment?.department_id) {
            setDepartmentId(assignment.department_id);
          } else if (task.assigned_to) {
            // If no department in assignment but employee is assigned, get from employee
            const { data: employee } = await supabase
              .from('employees')
              .select('department_id')
              .eq('id', task.assigned_to)
              .maybeSingle();
            
            if (employee?.department_id) {
              setDepartmentId(employee.department_id);
            }
          }
        };

        loadDepartment();
        setObjectiveId((task as any).objective_id || '');
        setObjectiveContext(null); // Will be resolved by next effect when individualObjectives loads
      }
    }
  }, [isOpen, taskId, tasks]);

  // Resolve objective context for display when we have objectiveId but no context yet (e.g. loaded from task)
  useEffect(() => {
    if (!objectiveId) {
      setObjectiveContext(null);
      return;
    }
    setObjectiveContext((prev) => {
      if (prev?.individualTitle) return prev; // Keep user selection from picker
      const obj = individualObjectives.find((o: any) => o.id === objectiveId);
      return obj ? { individualTitle: obj.title } : null;
    });
  }, [objectiveId, individualObjectives]);

  // Auto-select department when employee is selected
  useEffect(() => {
    const loadEmployeeDepartment = async () => {
      if (assignedTo) {
        const { data: employee } = await supabase
          .from('employees')
          .select('department_id')
          .eq('id', assignedTo)
          .maybeSingle();
        
        if (employee?.department_id) {
          setDepartmentId(employee.department_id);
        } else {
          setDepartmentId('');
        }
      } else {
        setDepartmentId('');
      }
    };
    
    loadEmployeeDepartment();
  }, [assignedTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !taskId) return;

    setIsSubmitting(true);
    try {
      // Format plan_date as YYYY-MM-01 (first day of month) if exists
      const planDateFormatted = planDate ? format(startOfMonth(planDate), 'yyyy-MM-dd') : null;
      
      await updateTask(taskId, {
        title: title.trim(),
        description: description.trim(),
        priority: priority as 'low' | 'medium' | 'high' | 'urgent' | 'needs_to_be_presented',
        status: status as 'pending' | 'in_progress' | 'completed' | 'cancelled',
        due_date: dueDate || null,
        plan_date: planDateFormatted,
        assigned_to: assignedTo || null,
        objective_id: objectiveId || null,
      });

      // Update department_id in daily_tasks_assigned
      if (assignedTo && departmentId) {
        const { data: existingAssignment } = await supabase
          .from('daily_tasks_assigned')
          .select('id')
          .eq('daily_task_id', taskId)
          .maybeSingle();

        if (existingAssignment) {
          await supabase
            .from('daily_tasks_assigned')
            .update({ department_id: departmentId })
            .eq('id', existingAssignment.id);
        }
      }

      onClose();
    } catch (error) {
      console.error('Error updating task:', error);
      toast({ title: 'Error', description: 'Failed to update task', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
    <Dialog
      open={isOpen}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent
        className={cn(
          'p-0 flex flex-col gap-0',
          isMobile
            ? 'fixed left-0 right-0 top-0 translate-x-0 translate-y-0 w-full max-w-none max-h-none rounded-none modal-above-safe-area z-30'
            : 'w-[620px] max-w-[90vw] max-h-[90vh] h-[600px]'
        )}
        overlayClassName={isMobile ? 'z-30' : undefined}
        hideCloseButton={isMobile}
        fullscreenAnimation={isMobile}
      >
        <DialogHeader className="flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-left safe-area-top px-4 pt-4 pb-3">
          <DialogTitle className="text-lg font-semibold">Edit Task</DialogTitle>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pt-4 pb-6"
            style={{
              scrollbarWidth: 'thin',
              scrollBehavior: 'smooth',
              scrollbarColor: '#d1d5db transparent',
            }}
          >
            <div className="space-y-6 min-w-0">
              <div className="space-y-4 min-w-0">
          {/* Task Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Task Title <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="What needs to be done?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSubmitting}
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <Textarea
                placeholder="Add description (optional)..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[120px] border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                disabled={isSubmitting}
              />
            </div>
            </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <Select value={priority} onValueChange={setPriority} disabled={isSubmitting}>
                <SelectTrigger className="border border-gray-200 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">
                    <div className="flex items-center gap-2">
                      <Flag className="w-4 h-4 text-green-600" />
                      Low
                    </div>
                  </SelectItem>
                  <SelectItem value="medium">
                    <div className="flex items-center gap-2">
                      <Flag className="w-4 h-4 text-blue-600" />
                      Medium
                    </div>
                  </SelectItem>
                  <SelectItem value="high">
                    <div className="flex items-center gap-2">
                      <Flag className="w-4 h-4 text-orange-600" />
                      High
                    </div>
                  </SelectItem>
                  <SelectItem value="urgent">
                    <div className="flex items-center gap-2">
                      <Flag className="w-4 h-4 text-red-600" />
                      Urgent
                    </div>
                  </SelectItem>
                  <SelectItem value="needs_to_be_presented">
                    <div className="flex items-center gap-2">
                      <Flag className="w-4 h-4 text-purple-600" />
                      Presentation
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <Select value={status} onValueChange={setStatus} disabled={isSubmitting}>
                <SelectTrigger className="border border-gray-200 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Individual Objective */}
          <div className="space-y-2 min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Individual Objective
            </label>
            <div className="flex items-center gap-2 min-w-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsObjectiveDialogOpen(true)}
                disabled={isSubmitting}
                className="flex-1 min-w-0 justify-start border border-gray-200 rounded-lg hover:bg-gray-50 h-10 overflow-hidden"
              >
                {objectiveId && objectiveContext ? (
                  <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                    <Target className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <div className="flex flex-col min-w-0 flex-1 text-left overflow-hidden">
                      <span className="text-sm truncate font-medium text-gray-900 block">
                        {objectiveContext.individualTitle}
                      </span>
                      {(objectiveContext.companyTitle || objectiveContext.departmentTitle) && (
                        <span className="text-xs text-gray-500 truncate block">
                          {objectiveContext.companyTitle && objectiveContext.departmentTitle
                            ? `${objectiveContext.companyTitle} → ${objectiveContext.departmentTitle}`
                            : objectiveContext.companyTitle || objectiveContext.departmentTitle}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 min-w-0 w-full overflow-hidden">
                    <Target className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <span className="text-gray-500 text-sm truncate text-left block min-w-0">
                      Select Individual Objective
                    </span>
                  </div>
                )}
              </Button>
              {objectiveId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setObjectiveId('');
                    setObjectiveContext(null);
                  }}
                  disabled={isSubmitting}
                  className="shrink-0 text-gray-500 hover:text-red-600 hover:border-red-200"
                  title={t('dailyTask.objective.unlink', 'Unlink')}
                >
                  <Unlink className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Plan Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Plan Date
              </label>
              <Popover open={isPlanDatePickerOpen} onOpenChange={setIsPlanDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmitting}
                    className="w-full justify-start border border-gray-200 rounded-lg hover:bg-gray-50 h-10"
                  >
                    {planDate ? (
                      <div className="flex items-center gap-2 w-full">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        <span className="text-sm text-left">
                          {format(planDate, 'MMMM yyyy', { locale: idLocale })}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-500 text-sm">Select Plan Date</span>
                      </div>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border border-gray-200 rounded-lg shadow-lg" align="start">
                  <MonthPicker
                    selected={planDate || undefined}
                    onSelect={(date) => {
                      setPlanDate(date);
                      setIsPlanDatePickerOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Date
              </label>
              <DueDatePicker
                value={dueDate}
                onChange={setDueDate}
                disabled={isSubmitting}
              />
            </div>

            {/* Assign To */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assign To
              </label>
              <Select
                value={assignedTo || 'unassigned'}
                onValueChange={(value) => setAssignedTo(value === 'unassigned' ? '' : value)}
                disabled={isSubmitting}
              >
                <SelectTrigger className="border border-gray-200 rounded-lg">
                  <SelectValue placeholder="Assign to...">
                    {assignedTo && assignedTo !== 'unassigned' ? (
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="text-sm">
                          {employees.find((e) => e.id === assignedTo)?.full_name || 'Select...'}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-500 text-sm">Assign to...</span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      Unassigned
                    </div>
                  </SelectItem>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-blue-600" />
                        {employee.full_name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Department */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <Select
                value={departmentId || ''}
                onValueChange={setDepartmentId}
                disabled={isSubmitting || !assignedTo}
              >
                <SelectTrigger className="border border-gray-200 rounded-lg">
                  <SelectValue placeholder="Select department...">
                    {departmentId ? (
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-500" />
                        <span className="text-sm">
                          {departments.find((d) => d.id === departmentId)?.name || 'Select...'}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-500 text-sm">Select department...</span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-blue-600" />
                        {department.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </form>
        
        {/* Action Buttons - rules: px-4 pt-3 pb-3, no safe-area-padding-bottom */}
        <div className="px-4 pt-3 pb-3 flex-shrink-0 border-t bg-muted/30">
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (formRef.current) {
                  formRef.current.requestSubmit();
                }
              }}
              disabled={!title.trim() || isSubmitting}
              className="min-w-[120px] flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Flag className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <ObjectiveHierarchyDialog
      open={isObjectiveDialogOpen}
      onOpenChange={setIsObjectiveDialogOpen}
      onSelect={(individualObjectiveId, context) => {
        setObjectiveId(individualObjectiveId);
        setObjectiveContext(context);
        setIsObjectiveDialogOpen(false);
      }}
      selectedObjectiveId={objectiveId || undefined}
      organizationId={organizationId || ''}
      cycleIds={activeCycleIds}
      planDate={planDate}
    />
    </>
  );
};

