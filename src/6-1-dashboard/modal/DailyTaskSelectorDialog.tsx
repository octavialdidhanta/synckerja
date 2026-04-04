import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Calendar } from '@/shared/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { CalendarIcon, Search, Loader2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/shared/lib/utils';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';
import { AssignSocialMediaPlanModal } from './AssignSocialMediaPlanModal';
import { toast } from 'sonner';
import { CreateTaskDialog } from '@/8-2-DailyTask/section/CreateTaskDialog';
import { id as idLocale } from 'date-fns/locale';
import { devLog } from '@/shared/lib/logger';

interface DailyTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
}

interface DailyTaskSelectorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (dailyTaskId: string, title: string, employeeId?: string, assignedAt?: string) => Promise<void>;
  dueDate?: string | null; // Due date from post_date in social_media_plans
  skipAssignment?: boolean; // Skip assignment modal if task step is auto-completed
  assignDisabledReason?: string; // If provided, disable assign in the nested modal
  serviceName?: string; // Service name from social_media_plans->services(name)
  organizationIdOverride?: string; // Optional override for organization id (e.g., from plan)
}

const DailyTaskSelectorDialog: React.FC<DailyTaskSelectorDialogProps> = ({
  isOpen,
  onClose,
  onSelect,
  dueDate,
  skipAssignment = false, // Default false untuk backward compatibility
  assignDisabledReason,
  serviceName,
  organizationIdOverride
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<Date | undefined>(undefined);
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [pendingAssignment, setPendingAssignment] = useState<{ employeeId?: string; assignedAt?: string } | null>(null);
  const { organizationId } = useCurrentOrg();
  const orgIdToUse = organizationIdOverride || organizationId;
  const { userRole, isOwner, isAdmin } = useCentralizedUserData();
  
  // Check if user can assign employees (Owner/Admin only)
  const canAssignEmployees = isOwner || isAdmin || userRole === 'owner' || userRole === 'admin';

  // Create Task fallback controls
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [prefillTitle, setPrefillTitle] = useState('');
  const [createOpenedOnce, setCreateOpenedOnce] = useState(false);

  // Normalize helper and server-side existence check for Branding Plan task
  const normalize = React.useCallback((s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim(), []);
  const checkBrandingTaskExists = React.useCallback(async (): Promise<boolean> => {
    try {
      if (!orgIdToUse || !dueDate || !serviceName) return false;
      const d = new Date(dueDate);
      if (isNaN(d.getTime())) return false;
      const { data: tasks } = await supabase
        .from('daily_tasks')
        .select('id, title')
        .eq('organization_id', orgIdToUse)
        .ilike('title', '%branding plan%')
        .order('created_at', { ascending: false });
      const monthLongID = format(d, 'MMMM yyyy', { locale: idLocale }).toLowerCase();
      const monthShortID = format(d, 'MMM yyyy', { locale: idLocale }).toLowerCase();
      const monthLongEN = format(d, 'MMMM yyyy').toLowerCase();
      const svc = normalize(serviceName);
      return (tasks || []).some(t => {
        const tnorm = normalize(t.title || '');
        return tnorm.includes('branding plan') &&
          tnorm.includes(svc) &&
          (tnorm.includes(monthLongID) || tnorm.includes(monthShortID) || tnorm.includes(monthLongEN));
      });
    } catch {
      return false;
    }
  }, [orgIdToUse, dueDate, serviceName, normalize]);
  const fetchDailyTasks = React.useCallback(async () => {
    if (!orgIdToUse) return;

    setIsLoading(true);
    try {
      let query = supabase
        .from('daily_tasks')
        .select('id, title, description, status, priority, due_date, created_at')
        .eq('organization_id', orgIdToUse)
        .order('created_at', { ascending: false });

      // Filter by month if selected
      if (selectedMonth) {
        const monthStart = startOfMonth(selectedMonth);
        const monthEnd = endOfMonth(selectedMonth);
        const startDateStr = format(monthStart, 'yyyy-MM-dd');
        const endDateStr = format(monthEnd, 'yyyy-MM-dd');
        
        // Filter tasks where due_date is within the selected month
        query = query
          .gte('due_date', startDateStr)
          .lte('due_date', endDateStr);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filter by search query
      let filteredTasks = data || [];
      if (searchQuery.trim()) {
        const searchLower = searchQuery.toLowerCase();
        filteredTasks = filteredTasks.filter(
          (task) =>
            task.title.toLowerCase().includes(searchLower) ||
            (task.description && task.description.toLowerCase().includes(searchLower))
        );
      }

      // Simplify list for specific month+service: show only "Branding Plan {service} {MMMM yyyy}"
      const isValidDue = !!dueDate && !isNaN(new Date(dueDate as string).getTime());
      const hasService = !!(serviceName && serviceName.trim().length > 0);
      if (isValidDue && hasService) {
        const due = new Date(dueDate as string);
        const monthLongID = format(due, 'MMMM yyyy', { locale: idLocale }).toLowerCase();
        const monthShortID = format(due, 'MMM yyyy', { locale: idLocale }).toLowerCase();
        const monthLongEN = format(due, 'MMMM yyyy').toLowerCase(); // fallback
        const serviceLower = normalize(serviceName as string);

        filteredTasks = filteredTasks.filter((task) => {
          const t = normalize(task.title);
          const hasBrandingPlan = t.includes('branding plan');
          const hasSvc = t.includes(serviceLower);
          const hasMonth = t.includes(monthLongID) || t.includes(monthShortID) || t.includes(monthLongEN);
          return hasBrandingPlan && hasSvc && hasMonth;
        });

        // Keep newest if multiple
        if (filteredTasks.length > 1) {
          filteredTasks = [filteredTasks[0]];
        }
      }

      setDailyTasks(filteredTasks);
    } catch (error) {
      devLog.error('Error fetching daily tasks:', error);
      toast.error('Failed to load daily tasks');
    } finally {
      setIsLoading(false);
    }
  }, [orgIdToUse, selectedMonth, searchQuery, dueDate, serviceName]);

  useEffect(() => {
    if (isOpen && orgIdToUse) {
      fetchDailyTasks();
      setCreateOpenedOnce(false);
    } else {
      // Reset state when dialog closes
      setSearchQuery('');
      setSelectedMonth(undefined);
      setDailyTasks([]);
      setSelectedTaskId(null);
      setIsCreateTaskOpen(false);
      setPrefillTitle('');
      setCreateOpenedOnce(false);
    }
  }, [isOpen, orgIdToUse, fetchDailyTasks]);

  // Handle month selection - when user clicks any date, filter by that month
  const handleMonthClick = (date: Date | undefined) => {
    if (date) {
      // Set to first day of the selected month for filtering
      const monthStart = startOfMonth(date);
      setSelectedMonth(monthStart);
    } else {
      setSelectedMonth(undefined);
    }
  };

  // Fallback: open Create Task only after confirming it doesn't exist on server
  useEffect(() => {
    const run = async () => {
      const isValidDue = !!dueDate && !isNaN(new Date(dueDate as string).getTime());
      const hasService = !!(serviceName && serviceName.trim().length > 0);
      if (isOpen && isValidDue && hasService && !isLoading && dailyTasks.length === 0 && !createOpenedOnce) {
        const exists = await checkBrandingTaskExists();
        if (!exists) {
          const d = new Date(dueDate as string);
          const monthText = format(d, 'MMMM yyyy', { locale: idLocale });
          setPrefillTitle(`${serviceName} - Branding Plan ${monthText}`);
          setIsCreateTaskOpen(true);
          setCreateOpenedOnce(true);
        }
      }
    };
    run();
  }, [isOpen, dueDate, serviceName, isLoading, dailyTasks, createOpenedOnce, checkBrandingTaskExists]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSelectTask = async () => {
    if (!selectedTaskId) {
      toast.error('Please select a daily task');
      return;
    }

    const selectedTask = dailyTasks.find((task) => task.id === selectedTaskId);
    if (!selectedTask) {
      toast.error('Selected task not found');
      return;
    }

    // Employee flow: jika assignDisabledReason ada (approved=false & belum ada step), blok add langsung
    if (!canAssignEmployees && assignDisabledReason) {
      toast.info(assignDisabledReason);
      return;
    }

    // If Owner/Admin and NOT skip assignment, show assignment modal
    // If skipAssignment = true (task step auto-completed), skip assign modal
    if (canAssignEmployees && !skipAssignment) {
      setPendingAssignment({});
      setShowAssignModal(true);
      return;
    }

    // Skip assignment modal: directly create task step (auto-completed)
    // Regular employee: directly assign to active profile
    setIsSubmitting(true);
    try {
      // Skip assignment - task step akan dibuat sebagai completed
      await onSelect(selectedTaskId, selectedTask.title);
      // Don't show success toast here if skipAssignment = true (hook will show it)
      // Don't call onClose() here if skipAssignment = true (hook will close modal after success)
      if (!skipAssignment) {
        toast.success('Content title added as daily task step successfully');
        onClose();
      }
      // If skipAssignment = true, hook will handle closing and showing success toast
    } catch (error) {
      devLog.error('Error selecting task:', error);
      toast.error('Failed to add as daily task');
      // On error, don't close modal - let user retry or cancel
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssign = async (assignment: { employeeId: string; assignedAt: string }) => {
    if (!selectedTaskId) {
      toast.error('Please select a daily task');
      return;
    }

    const selectedTask = dailyTasks.find((task) => task.id === selectedTaskId);
    if (!selectedTask) {
      toast.error('Selected task not found');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSelect(selectedTaskId, selectedTask.title, assignment.employeeId, assignment.assignedAt);
      toast.success('Content title added as daily task step successfully');
      setShowAssignModal(false);
      setPendingAssignment(null);
      onClose();
    } catch (error) {
      devLog.error('Error selecting task:', error);
      toast.error('Failed to add as daily task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'low':
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'in_progress':
        return 'bg-blue-100 text-blue-700';
      case 'cancelled':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-yellow-100 text-yellow-700';
    }
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto seamless-scroll">
        <DialogHeader>
          <DialogTitle>Select Daily Task</DialogTitle>
          <DialogDescription>
            Choose a daily task to reference this content title
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            {/* Search Bar */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search daily tasks..."
                  value={searchQuery}
                  onChange={handleSearch}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Month Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-[240px] justify-start text-left font-normal',
                    !selectedMonth && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedMonth ? format(selectedMonth, 'MMMM yyyy') : 'Filter by month'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3">
                  <Calendar
                    mode="single"
                    selected={selectedMonth}
                    onSelect={handleMonthClick}
                    initialFocus
                    classNames={{
                      caption_label: 'text-sm font-medium cursor-pointer hover:bg-gray-100 rounded px-2 py-1 transition-colors',
                    }}
                    components={{
                      CaptionLabel: ({ displayMonth, ...props }: any) => {
                        const handleCaptionClick = (e: React.MouseEvent) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const monthStart = startOfMonth(displayMonth);
                          setSelectedMonth(monthStart);
                        };
                        return (
                          <button
                            type="button"
                            onClick={handleCaptionClick}
                            className="text-sm font-medium cursor-pointer hover:bg-gray-100 rounded px-2 py-1 transition-colors"
                            {...props}
                          >
                            {format(displayMonth, 'MMMM yyyy')}
                          </button>
                        );
                      },
                    }}
                  />
                </div>
                {selectedMonth && (
                  <div className="p-3 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedMonth(undefined)}
                      className="w-full"
                    >
                      Clear month filter
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>

          {/* Task List */}
          <div className="border rounded-lg max-h-[400px] overflow-y-auto seamless-scroll">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">Loading daily tasks...</span>
              </div>
            ) : dailyTasks.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                {searchQuery || selectedMonth
                  ? 'No daily tasks found matching your filters'
                  : 'No daily tasks available'}
              </div>
            ) : (
              <div className="divide-y">
                {dailyTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    className={cn(
                      'p-4 cursor-pointer hover:bg-gray-50 transition-colors',
                      selectedTaskId === task.id && 'bg-blue-50 border-l-4 border-blue-500'
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-medium text-sm mb-1">{task.title}</h3>
                        {task.description && (
                          <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                            {task.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded text-xs font-medium',
                              getStatusColor(task.status)
                            )}
                          >
                            {task.status.replace('_', ' ')}
                          </span>
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded text-xs font-medium border',
                              getPriorityColor(task.priority)
                            )}
                          >
                            {task.priority}
                          </span>
                          {task.due_date && (
                            <span className="text-xs text-gray-500">
                              Due: {format(new Date(task.due_date), 'MMM dd, yyyy')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                          selectedTaskId === task.id
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                        )}
                      >
                        {selectedTaskId === task.id && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSelectTask}
              disabled={!selectedTaskId || isSubmitting || isCreateTaskOpen}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add as Daily Task'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
      
      {/* Assignment Modal for Owner/Admin */}
      {canAssignEmployees && selectedTaskId && (
        <AssignSocialMediaPlanModal
          open={showAssignModal}
          onOpenChange={setShowAssignModal}
          onAssign={handleAssign}
          dueDate={dueDate || null}
          taskTitle={dailyTasks.find((task) => task.id === selectedTaskId)?.title || ''}
          disabledReason={assignDisabledReason}
        />
      )}
    </Dialog>
    
    {/* Create Task dialog with prefilled title (fallback) - uses DailyTaskProvider from dashboard */}
    <CreateTaskDialog
      open={isCreateTaskOpen}
      onOpenChange={(open) => {
        setIsCreateTaskOpen(open);
        if (!open) {
          // refresh list after closing create dialog
          fetchDailyTasks();
        }
      }}
      defaultTitle={prefillTitle}
      defaultPlanDate={dueDate ? new Date(dueDate as string) : null}
    />
    </>
  );
};

export default DailyTaskSelectorDialog;

