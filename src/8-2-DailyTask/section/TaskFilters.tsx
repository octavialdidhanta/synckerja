import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Search, CalendarIcon, Plus, Building2, RefreshCw } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/shared/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import { useDailyTask } from '../DailyTaskContext';
import { useActiveEmployeeIds } from '../hooks/useActiveEmployeeIds';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useToast } from '@/shared/components/ui/use-toast';
import { CustomDatePicker } from '@/mobile/components/CustomDatePicker';
import { format, startOfMonth } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';
import { CreateTaskDialog } from './CreateTaskDialog';
import { MonthPicker } from '@/shared/calendar';
import { supabase } from '@/shared/lib/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/hooks/useCurrentOrg';

interface TaskFiltersProps {
  onAddTask?: () => void;
  showAddTaskButton?: boolean;
}

export const TaskFilters = ({ onAddTask, showAddTaskButton = true }: TaskFiltersProps = {}) => {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { filters, setFilters, tasks, refetchTasks, resetFilters, highlightFromPendingApproval } = useDailyTask();
  const { organizationId } = useCurrentOrg();
  const [isCustomDatePickerOpen, setIsCustomDatePickerOpen] = useState(false);
  const [isPlanDatePickerOpen, setIsPlanDatePickerOpen] = useState(false);
  const [isCreateTaskDialogOpen, setIsCreateTaskDialogOpen] = useState(false);
  const { isOwner } = useCentralizedUserData();
  const planDateSelectTriggerRef = useRef<HTMLButtonElement>(null);
  const activeEmployeeIds = useActiveEmployeeIds();

  // Clear PIC if selected employee is no longer active (e.g. resigned)
  useEffect(() => {
    if (filters.pic && activeEmployeeIds.size > 0 && !activeEmployeeIds.has(filters.pic)) {
      setFilters(prev => ({ ...prev, pic: '', picLevel: undefined }));
    }
  }, [filters.pic, activeEmployeeIds, setFilters]);

  // Fetch departments
  const { data: departments = [], isError: departmentsError, refetch: refetchDepartments } = useQuery({
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

  // Get unique employees from all task steps for PIC filter; exclude resigned/inactive
  const availableEmployees = useMemo(() => {
    const employeeMap = new Map<string, { id: string; full_name: string }>();

    tasks.forEach(task => {
      task.steps?.forEach(step => {
        if (step.assigned_employee?.id && activeEmployeeIds.has(step.assigned_employee.id)) {
          employeeMap.set(step.assigned_employee.id, {
            id: step.assigned_employee.id,
            full_name: step.assigned_employee.full_name || 'Unknown',
          });
        }
      });
    });

    return Array.from(employeeMap.values()).sort((a, b) =>
      a.full_name.localeCompare(b.full_name)
    );
  }, [tasks, activeEmployeeIds]);

  const handleSearchChange = (value: string) => {
    setFilters(prev => ({ ...prev, search: value }));
  };

  const handleStatusChange = (value: string) => {
    setFilters(prev => ({ ...prev, status: value }));
  };

  const handlePriorityChange = (value: string) => {
    setFilters(prev => ({ ...prev, priority: value }));
  };

  const handleObjectiveLinkChange = (value: string) => {
    setFilters(prev => ({ ...prev, objectiveLink: value === 'unlinked' ? 'unlinked' : 'all' }));
  };

  const handleDepartmentChange = (value: string) => {
    if (value === '__retry__') {
      refetchDepartments();
      return;
    }
    setFilters(prev => ({ ...prev, department: value === "all" ? undefined : value }));
  };

  const handleTaskViewChange = (value: string) => {
    if (value === 'my_task') {
      setFilters(prev => ({ ...prev, myTask: 'my_task', pic: '', picLevel: undefined }));
    } else if (value === 'all_pic') {
      setFilters(prev => ({ ...prev, myTask: 'all', pic: '', picLevel: undefined }));
    } else {
      // Individual PIC selected - set default level to 'task' if not set
      setFilters(prev => ({ 
        ...prev, 
        myTask: 'all', 
        pic: value,
        picLevel: prev.picLevel || 'task' // Keep existing level or default to 'task'
      }));
    }
  };

  const handlePicLevelChange = (value: string) => {
    setFilters(prev => ({ 
      ...prev, 
      picLevel: value as 'task' | 'step' | 'sub_step'
    }));
  };

  // Get current selected value for combined dropdown (exclude resigned PIC)
  const getCurrentTaskViewValue = () => {
    if (filters.myTask === 'my_task') return 'my_task';
    if (filters.pic && activeEmployeeIds.has(filters.pic)) return filters.pic;
    return 'all_pic';
  };

  // Get display text for combined dropdown
  const getTaskViewDisplayText = () => {
    if (filters.myTask === 'my_task') return 'My Task';
    if (filters.pic && activeEmployeeIds.has(filters.pic)) {
      const selectedEmployee = availableEmployees.find(emp => emp.id === filters.pic);
      return selectedEmployee ? selectedEmployee.full_name : 'All tasks';
    }
    return 'All tasks';
  };

  const handleDateRangeChange = (value: string) => {
    if (value === 'custom') {
      setIsCustomDatePickerOpen(true);
    } else {
      setFilters(prev => ({ 
        ...prev, 
        dateRange: value === "all" ? undefined : value as any,
        customStartDate: undefined,
        customEndDate: undefined
      }));
    }
  };

  // Merged Date & Plan: single value for combined dropdown (date options without This Month/Last Month)
  const getMergedDatePlanValue = () => {
    if (filters.dateRange) return filters.dateRange;
    if (filters.planDateRange) return filters.planDateRange;
    return 'all';
  };

  const getMergedDatePlanDisplayText = () => {
    if (filters.dateRange) return getDateRangeDisplayText();
    if (filters.planDateRange) return getPlanDateRangeDisplayText();
    return 'All Dates & Plans';
  };

  const handleMergedDatePlanChange = (value: string) => {
    if (value === 'all') {
      setFilters(prev => ({
        ...prev,
        dateRange: undefined,
        customStartDate: undefined,
        customEndDate: undefined,
        planDateRange: undefined,
        customPlanMonth: undefined
      }));
      return;
    }
    const dateOptions = ['today', 'yesterday', 'this_week', 'custom'];
    const planOptions = ['this_month_plan', 'next_month_plan', 'last_month_plan', 'custom_month_plan'];
    if (dateOptions.includes(value)) {
      if (value === 'custom') {
        setFilters(prev => ({ ...prev, dateRange: 'custom', planDateRange: undefined, customPlanMonth: undefined }));
        setIsCustomDatePickerOpen(true);
      } else {
        setFilters(prev => ({
          ...prev,
          dateRange: value as any,
          customStartDate: undefined,
          customEndDate: undefined,
          planDateRange: undefined,
          customPlanMonth: undefined
        }));
      }
      return;
    }
    if (planOptions.includes(value)) {
      if (value === 'custom_month_plan') {
        setFilters(prev => ({ ...prev, planDateRange: 'custom_month_plan', dateRange: undefined, customStartDate: undefined, customEndDate: undefined }));
        setTimeout(() => setIsPlanDatePickerOpen(true), 150);
      } else {
        setFilters(prev => ({
          ...prev,
          planDateRange: value as any,
          customPlanMonth: undefined,
          dateRange: undefined,
          customStartDate: undefined,
          customEndDate: undefined
        }));
      }
    }
  };

  const handleCustomDateRangeSelect = (startDate: Date, endDate: Date) => {
    setFilters(prev => ({ 
      ...prev, 
      dateRange: 'custom',
      customStartDate: format(startDate, 'yyyy-MM-dd'),
      customEndDate: format(endDate, 'yyyy-MM-dd')
    }));
  };

  const handlePlanDateRangeChange = (value: string) => {
    if (value === 'custom_month_plan') {
      // Delay opening popover to ensure Select closes first
      setTimeout(() => {
        setIsPlanDatePickerOpen(true);
      }, 150);
    } else {
      setFilters(prev => ({ 
        ...prev, 
        planDateRange: value === "all" ? undefined : value as any,
        customPlanMonth: undefined
      }));
    }
  };

  const handleCustomPlanMonthSelect = (date: Date) => {
    const monthStart = startOfMonth(date);
    setFilters(prev => ({ 
      ...prev, 
      planDateRange: 'custom_month_plan',
      customPlanMonth: format(monthStart, 'yyyy-MM-dd')
    }));
    setIsPlanDatePickerOpen(false);
  };

  const getPlanDateRangeDisplayText = () => {
    if (filters.planDateRange === 'custom_month_plan' && filters.customPlanMonth) {
      const month = new Date(filters.customPlanMonth);
      return format(month, 'MMMM yyyy', { locale: idLocale });
    }
    if (filters.planDateRange) {
      const labels: Record<string, string> = {
        'this_month_plan': 'This Month Plan',
        'next_month_plan': 'Next Month Plan',
        'last_month_plan': 'Last Month Plan',
        'custom_month_plan': 'Custom Month'
      };
      return labels[filters.planDateRange] || 'All Plans';
    }
    return 'All Plans';
  };

  const getDateRangeDisplayText = () => {
    if (filters.dateRange === 'custom' && filters.customStartDate && filters.customEndDate) {
      const start = new Date(filters.customStartDate);
      const end = new Date(filters.customEndDate);
      return `${format(start, 'MMM dd')} - ${format(end, 'MMM dd')}`;
    }
    if (filters.dateRange) {
      const labels: Record<string, string> = {
        'today': 'Today',
        'yesterday': 'Yesterday',
        'this_week': 'This Week',
        'this_month': 'This Month',
        'last_month': 'Last Month'
      };
      return labels[filters.dateRange] || 'Custom Range';
    }
    return 'All Dates';
  };

  return (
    <div className="w-full min-w-0">
      <div className="p-1.5 sm:p-2 bg-white border border-gray-200 rounded-md min-w-0 overflow-hidden">
        <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto overflow-y-hidden min-w-0 seamless-scroll nested-scroll-touch-chain">
      {/* Search Input - Hidden when PIC filter is active */}
      {!filters.pic && (
        <div className="relative flex-1 min-w-[120px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
          <Input
            placeholder="Search tasks and steps..."
            value={filters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-7 pr-2 h-8 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
      )}

      {/* Department Filter — icon + "All Departments" needs more width than Priority-only trigger */}
      <Select
        value={departmentsError ? 'all' : (filters.department || 'all')}
        onValueChange={handleDepartmentChange}
      >
        <SelectTrigger className="min-w-[152px] w-[152px] sm:min-w-[164px] sm:w-[164px] shrink-0 h-8 text-xs sm:text-sm text-gray-700 text-left whitespace-nowrap overflow-hidden">
          <SelectValue placeholder="All Departments">
            {departmentsError ? (
              <span className="truncate text-amber-600">Failed to load</span>
            ) : filters.department ? (
              <div className="flex items-center gap-2 whitespace-nowrap overflow-hidden">
                <Building2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span className="truncate">{departments.find(d => d.id === filters.department)?.name || 'All Departments'}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 whitespace-nowrap overflow-hidden">
                <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="truncate">All Departments</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Departments</SelectItem>
          {departmentsError && (
            <SelectItem value="__retry__">Retry</SelectItem>
          )}
          {!departmentsError && departments.map((department) => (
            <SelectItem key={department.id} value={department.id}>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                {department.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Combined My Task / All tasks / PIC Filter - "All tasks" shown for everyone so list is not empty by default */}
      <Select value={getCurrentTaskViewValue()} onValueChange={handleTaskViewChange}>
<SelectTrigger className="w-[100px] sm:w-28 shrink-0 h-8 text-xs sm:text-sm text-gray-700 text-left">
        <SelectValue placeholder="All tasks" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all_pic">All tasks</SelectItem>
          <SelectItem value="my_task">My Task</SelectItem>
          {isOwner && availableEmployees.map((employee) => (
            <SelectItem key={employee.id} value={employee.id}>
              {employee.full_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* PIC Level Filter - Only show when PIC is selected */}
      {filters.pic && (
        <Select 
          value={filters.picLevel || 'task'} 
          onValueChange={handlePicLevelChange}
        >
          <SelectTrigger className="w-[90px] sm:w-24 shrink-0 h-8 text-xs sm:text-sm text-gray-700 text-left">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="task">Task</SelectItem>
            <SelectItem value="step">Step</SelectItem>
            <SelectItem value="sub_step">Sub Step</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* Status Filter */}
      <Select value={filters.status || "all"} onValueChange={(value) => handleStatusChange(value === "all" ? "" : value)}>
        <SelectTrigger className="w-[95px] sm:w-28 shrink-0 h-8 text-xs sm:text-sm text-gray-700 text-left">
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
        </SelectContent>
      </Select>

      {/* Priority Filter — enough room for "All Priority" / "Presentation" without feeling oversized */}
      <Select value={filters.priority || "all"} onValueChange={(value) => handlePriorityChange(value === "all" ? "" : value)}>
        <SelectTrigger className="min-w-[120px] w-[120px] sm:min-w-[132px] sm:w-[132px] shrink-0 h-8 text-xs sm:text-sm text-gray-700 text-left">
          <SelectValue placeholder="All Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Priority</SelectItem>
          <SelectItem value="low">Low</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="urgent">Urgent</SelectItem>
          <SelectItem value="needs_to_be_presented">Presentation</SelectItem>
        </SelectContent>
      </Select>

      {/* Objective link: All / Unlinked tasks */}
      <Select value={filters.objectiveLink || 'all'} onValueChange={handleObjectiveLinkChange}>
        <SelectTrigger className="w-[85px] sm:w-24 shrink-0 h-8 text-xs sm:text-sm text-gray-700 text-left">
          <SelectValue placeholder={t('dailyTask.filters.objectiveLink', 'Objective link')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('dailyTask.filters.all', 'All')}</SelectItem>
          <SelectItem value="unlinked">{t('dailyTask.filters.unlinkedTasks', 'Unlinked tasks')}</SelectItem>
        </SelectContent>
      </Select>

      {/* Merged Date & Plan Filter (All Dates + All Plans in one; This Month / Last Month removed from date, use Plan section) */}
      <div className="relative shrink-0">
        <Select 
          value={getMergedDatePlanValue()} 
          onValueChange={handleMergedDatePlanChange}
        >
          <SelectTrigger 
            ref={planDateSelectTriggerRef}
            className="w-auto min-w-[130px] max-w-[200px] shrink-0 h-8 text-xs sm:text-sm text-gray-700 text-left whitespace-nowrap overflow-hidden"
          >
            <div className="flex items-center gap-2 whitespace-nowrap overflow-hidden">
              <CalendarIcon className="h-4 w-4 text-gray-500" />
              <SelectValue placeholder="All Dates & Plans" className="truncate">
                {getMergedDatePlanDisplayText()}
              </SelectValue>
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Dates & Plans</SelectItem>
            <SelectGroup>
              <SelectLabel className="text-xs text-gray-500 font-medium">Due date</SelectLabel>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectLabel className="text-xs text-gray-500 font-medium">Plan</SelectLabel>
              <SelectItem value="this_month_plan">This Month Plan</SelectItem>
              <SelectItem value="next_month_plan">Next Month Plan</SelectItem>
              <SelectItem value="last_month_plan">Last Month Plan</SelectItem>
              <SelectItem value="custom_month_plan">Custom Month</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Month Picker Popover - for Custom Month Plan */}
        <Popover open={isPlanDatePickerOpen} onOpenChange={setIsPlanDatePickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
              aria-hidden="true"
              tabIndex={-1}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                pointerEvents: 'none'
              }}
            />
          </PopoverTrigger>
          <PopoverContent 
            className="w-auto p-2 border border-gray-200 rounded-lg shadow-lg" 
            align="start"
            side="bottom"
            sideOffset={4}
          >
            <div className="text-sm font-medium text-gray-700 mb-2 px-2 flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-blue-500" />
              Select Plan Date
            </div>
            <MonthPicker
              selected={filters.customPlanMonth ? new Date(filters.customPlanMonth) : undefined}
              onSelect={handleCustomPlanMonthSelect}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Refresh Button - reset all filters and show full task list (clears pending-approval focus) */}
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          resetFilters();
          try {
            await refetchTasks();
          } catch {
            toast({ title: 'Error', description: 'Failed to refresh tasks', variant: 'destructive' });
          }
        }}
        className={`shrink-0 h-8 w-8 p-0 ${highlightFromPendingApproval ? 'border-amber-300 text-amber-700 hover:bg-amber-50' : ''}`}
        title={highlightFromPendingApproval ? t('dailyTask.filters.refreshShowAll', 'Refresh to show all tasks') : t('dailyTask.filters.refresh', 'Refresh')}
      >
        <RefreshCw className="w-4 h-4" />
      </Button>

      {/* Add Task Button */}
      {showAddTaskButton && (
        <Button
          onClick={() => setIsCreateTaskDialogOpen(true)}
          className="shrink-0 ml-auto bg-blue-600 hover:bg-blue-700 text-white px-3 h-8 flex items-center gap-1.5 text-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Task
        </Button>
      )}

      {/* Custom Date Picker Dialog */}
      <CustomDatePicker
        isOpen={isCustomDatePickerOpen}
        onClose={() => setIsCustomDatePickerOpen(false)}
        onDateRangeSelect={handleCustomDateRangeSelect}
        initialStartDate={filters.customStartDate ? new Date(filters.customStartDate) : undefined}
        initialEndDate={filters.customEndDate ? new Date(filters.customEndDate) : undefined}
      />


      {/* Create Task Dialog */}
      {showAddTaskButton && (
        <CreateTaskDialog
          open={isCreateTaskDialogOpen}
          onOpenChange={(open) => {
            setIsCreateTaskDialogOpen(open);
            if (onAddTask && !open) {
              onAddTask();
            }
          }}
        />
      )}
    </div>
      </div>
    </div>
  );
};


