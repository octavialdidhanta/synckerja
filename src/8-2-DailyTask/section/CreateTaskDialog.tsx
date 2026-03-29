import React, { useState } from 'react';
import { Plus, Flag, User, Target, UserPlus, ArrowLeft, Calendar } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Label } from '@/shared/components/ui/label';
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
import { useDailyTask } from '@/8-2-DailyTask/DailyTaskContext';
import { AssignTaskModal } from './AssignTaskModal';
import { useAvailableEmployees } from '@/shared/hooks/useAvailableEmployees';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { useIndividualObjectives } from '@/1-home/components/HomeOKRDashboard/modal/useIndividualObjectives';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useOkrCycles } from '@/1-home/components/HomeOKRDashboard/hooks/useOkrCycles';
import { ObjectiveHierarchyDialog } from '@/8-2-DailyTask/section/ObjectiveHierarchyDialog';
import { useIsMobile } from '@/mobile/hooks/use-mobile';
import { MonthPicker } from '@/shared/calendar';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useToast } from '@/shared/components/ui/use-toast';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { startOfMonth } from 'date-fns';

export interface TaskFormData {
  title: string;
  description: string;
  priority: string;
  objective_id: string | null;
  plan_date: string | null;
  due_date: string | null;
  assigned_to: string | null;
  status: string;
}

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTitle?: string;
  defaultPlanDate?: Date | null; // Optional: for auto-create from social media dashboard
  defaultDescription?: string; // Optional: e.g. from sales_activities.description
  dismissible?: boolean; // When false, dialog cannot be closed by overlay/Escape/X until "Create Task" is clicked
  /** When set (e.g. from sales first payment), submit calls this instead of addTask; parent opens SOP popup then creates task+steps. */
  onSubmitWithSop?: (formData: TaskFormData) => void;
}

export const CreateTaskDialog: React.FC<CreateTaskDialogProps> = ({
  open,
  onOpenChange,
  defaultTitle,
  defaultPlanDate,
  defaultDescription,
  dismissible = true,
  onSubmitWithSop,
}) => {
  const { t } = useAppTranslation();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { addTask } = useDailyTask();
  const { data: employees = [] } = useAvailableEmployees();
  const { data: currentEmployee } = useCurrentEmployee();
  const { organizationId } = useCurrentOrg();
  const { data: cycles = [] } = useOkrCycles(organizationId);

  // State declarations - must be before useMemo that uses planDate
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [objectiveId, setObjectiveId] = useState<string>('');
  const [objectiveContext, setObjectiveContext] = useState<{
    companyTitle?: string;
    departmentTitle?: string;
    individualTitle: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isObjectiveDialogOpen, setIsObjectiveDialogOpen] = useState(false);
  const [planDate, setPlanDate] = useState<Date | null>(null);
  const [isPlanDatePickerOpen, setIsPlanDatePickerOpen] = useState(false);
  
  // Get cycle IDs based on plan date
  // If planDate is set, filter cycles that overlap with the plan date month
  // Only show cycles where the plan date month falls within the cycle's date range
  // Otherwise, include active cycles and cycles from current year and next year
  const activeCycleIds = React.useMemo(() => {
    if (planDate) {
      // Filter cycles based on quarter logic
      // For quarterly cycles: match the quarter that contains the plan date month
      // For yearly cycles: match if the plan date falls within the cycle date range
      const planDateObj = new Date(planDate);
      const planYear = planDateObj.getFullYear();
      const planMonth = planDateObj.getMonth() + 1; // 1-12 (January = 1)
      
      // Calculate first and last day of plan date month in local timezone
      const planMonthStart = new Date(planYear, planMonth - 1, 1, 0, 0, 0, 0);
      const planMonthEnd = new Date(planYear, planMonth, 0, 23, 59, 59, 999); // Last day of month
      
      // Determine which quarter the plan date month belongs to (both uppercase and lowercase)
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
        .filter(cycle => {
          const cyclePeriodType = (cycle as any).period_type;
          const cycleQuarter = (cycle as any).quarter;
          const cycleYear = (cycle as any).year;
          const cycleStartStr = (cycle as any).start_date;
          const cycleEndStr = (cycle as any).end_date;
          
          // Parse cycle dates
          const [startYear, startMonth, startDay] = cycleStartStr.split('-').map(Number);
          const [endYear, endMonth, endDay] = cycleEndStr.split('-').map(Number);
          
          const cycleStart = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
          const cycleEnd = new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999);
          
          // Check date overlap first (applies to all cycle types)
          const overlaps = cycleStart <= planMonthEnd && cycleEnd >= planMonthStart;
          
          // For quarterly cycles: check if quarter and year match (case-insensitive)
          if (cyclePeriodType === 'quarterly' || cycleQuarter) {
            // Check both uppercase and lowercase quarter values
            const quarterMatches = cycleQuarter && (
              cycleQuarter.toLowerCase() === expectedQuarterLower ||
              cycleQuarter.toUpperCase() === expectedQuarter
            );
            const yearMatches = cycleYear === planYear;
            
            return quarterMatches && yearMatches && overlaps;
          }
          
          if (cyclePeriodType === 'yearly') return overlaps;

          if (!cyclePeriodType) return overlaps;
          
          return false;
        })
        .map(cycle => cycle.id);

      return filteredCycles;
    } else {
      // Fallback: include active cycles and cycles from current year and next year
      const currentYear = new Date().getFullYear();
      return cycles
        .filter(cycle => {
          const cycleYear = (cycle as any).year;
          return (cycle as any).is_active === true || 
                 (cycleYear === currentYear || cycleYear === currentYear + 1);
        })
        .map(cycle => cycle.id);
    }
  }, [cycles, planDate]);
    
  const { data: individualObjectives = [] } = useIndividualObjectives(organizationId, activeCycleIds);
  
  // Assignment state - will be set via modal
  const [assignment, setAssignment] = useState<{
    employeeId: string | null;
    deadline: string | null;
  }>({
    employeeId: null,
    deadline: null
  });
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Prefill title, description, and plan date when dialog opens
  React.useEffect(() => {
    if (open) {
      setTitle(defaultTitle || '');
      setDescription(defaultDescription || '');
      // Set plan date from defaultPlanDate if provided, otherwise null (user must select)
      if (defaultPlanDate) {
        setPlanDate(startOfMonth(defaultPlanDate));
      } else {
        setPlanDate(null);
      }
    }
  }, [open, defaultTitle, defaultPlanDate, defaultDescription]);

  const handleAssign = (newAssignment: { employeeId: string | null; deadline: string | null }) => {
    setAssignment(newAssignment);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) return;

    // Validate that Plan date is selected (required)
    if (!planDate) {
      toast({
        title: t('dailyTask.createTask.validationError', 'Validation'),
        description: t('dailyTask.createTask.planDateRequired', 'Please select a Plan date before creating the task.'),
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const planDateFormatted = format(startOfMonth(planDate), 'yyyy-MM-dd');
      const formData: TaskFormData = {
        title: title.trim(),
        description: description.trim(),
        priority,
        objective_id: objectiveId || null,
        plan_date: planDateFormatted,
        due_date: assignment.deadline || null,
        assigned_to: assignment.employeeId || null,
        status: 'pending',
      };

      if (onSubmitWithSop) {
        onSubmitWithSop(formData);
        setTitle('');
        setDescription('');
        setPriority('medium');
        setObjectiveId('');
        setObjectiveContext(null);
        setPlanDate(null);
        setAssignment({ employeeId: null, deadline: null });
        setIsSubmitting(false);
        return;
      }

      await addTask({
        ...formData,
        priority: formData.priority as 'low' | 'medium' | 'high' | 'urgent' | 'needs_to_be_presented',
      } as any);

      setTitle('');
      setDescription('');
      setPriority('medium');
      setObjectiveId('');
      setObjectiveContext(null);
      setPlanDate(null);
      setAssignment({ employeeId: null, deadline: null });
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding task:', error);
      toast({ title: 'Error', description: 'Failed to add task', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset form when closing
    setTitle('');
    setDescription('');
    setPriority('medium');
    setObjectiveId('');
    setObjectiveContext(null);
    setPlanDate(null);
    setAssignment({ employeeId: null, deadline: null });
    onOpenChange(false);
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!value && dismissible) {
            handleClose();
          }
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
          hideCloseButton={isMobile || !dismissible}
          fullscreenAnimation={isMobile}
          onInteractOutside={(e) => {
            if (!dismissible) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (!dismissible) e.preventDefault();
          }}
        >
          <DialogHeader className="flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-left safe-area-top px-4 pt-4 pb-3">
            <DialogTitle className="text-lg font-semibold">{t('dailyTask.createTask.title', 'Create New Task')}</DialogTitle>
          </DialogHeader>

          <form id="create-task-form" onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Scrollable body: on input focus, consider scrollIntoView({ behavior: 'smooth', block: 'nearest' }) so the field stays visible when soft keyboard opens on Android. */}
            <div
              className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pt-4 pb-6"
              style={{
                scrollbarWidth: 'thin',
                scrollBehavior: 'smooth',
                scrollbarColor: '#d1d5db transparent',
              }}
            >
              <div className="space-y-6">
                {/* Task Title & Description */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="create-task-title" className="text-sm font-medium">
                      Task Title <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="create-task-title"
                      name="title"
                      placeholder="What needs to be done?"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={isSubmitting}
                      required
                      autoFocus
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="create-task-description" className="text-sm font-medium">
                      Description
                    </Label>
                    <Textarea
                      id="create-task-description"
                      name="description"
                      placeholder="Add description (optional)..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="min-h-[100px] border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                      disabled={isSubmitting}
                      rows={4}
                    />
                  </div>
                </div>

                {/* Priority & Objective */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="priority" className="text-sm font-medium">
                      Priority <span className="text-red-500">*</span>
                    </Label>
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

                  <div className="space-y-2 min-w-0">
                    <Label className="text-sm font-medium">
                      Individual Objective
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsObjectiveDialogOpen(true)}
                      disabled={isSubmitting}
                      className="w-full min-w-0 justify-start border border-gray-200 rounded-lg hover:bg-gray-50 h-10 overflow-hidden"
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
                                  ? `${objectiveContext.companyTitle} â†’ ${objectiveContext.departmentTitle}`
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
                  </div>
                </div>

                {/* Plan Date */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Plan Date <span className="text-red-500">*</span>
                  </Label>
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

                {/* Assignment */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Assignment</Label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAssignModal(true)}
                    disabled={isSubmitting}
                    className="w-full justify-start border border-gray-200 rounded-lg hover:bg-gray-50 h-10"
                  >
                    {assignment.employeeId ? (
                      <div className="flex items-center gap-2 w-full">
                        <User className="w-4 h-4 text-blue-600" />
                        <span className="text-sm truncate flex-1 text-left">
                          {employees.find(e => e.id === assignment.employeeId)?.full_name || 'Assigned'}
                        </span>
                        {assignment.deadline && (
                          <span className="text-xs text-gray-500">
                            {new Date(assignment.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <UserPlus className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-500 text-sm">Assign Task (Optional)</span>
                      </div>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="px-4 pt-3 pb-3 flex-shrink-0 border-t bg-muted/30">
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!title.trim() || !planDate || isSubmitting}
                  className="min-w-[120px] flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Adding...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Create Task</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign Task Modal */}
      <AssignTaskModal
        open={showAssignModal}
        onOpenChange={setShowAssignModal}
        onAssign={handleAssign}
        currentAssignment={assignment}
      />

      {/* Lazy-load objective dialogs only when open so Company/Department objectives aren't fetched on page load */}
      {isObjectiveDialogOpen && (
        <ObjectiveHierarchyDialog
          open={isObjectiveDialogOpen}
          onOpenChange={setIsObjectiveDialogOpen}
          onSelect={(id, context) => {
            setObjectiveId(id);
            setObjectiveContext(context);
          }}
          selectedObjectiveId={objectiveId}
          organizationId={organizationId || ''}
          cycleIds={activeCycleIds}
          planDate={planDate}
        />
      )}
    </>
  );
};


