import React, { useState, useEffect } from 'react';
import { Users, Search } from 'lucide-react';
import { Button } from '@/features/ui/button';
import { Input } from '@/features/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/features/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/features/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/features/ui/use-toast';
import { logger } from '@/config/logger';
import { useCurrentOrg } from '@/features/1-login/hooks/useCurrentOrg';
import { useAvailableEmployees } from '@/features/share/hooks/useAvailableEmployees';
import { useIsMobile } from '@/mobile/hooks/use-mobile';
import { Skeleton } from '@/mobile/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Employee {
  id: string;
  full_name: string;
  email?: string;
  status?: string;
}

interface MobileAssignStepDialogProps {
  open?: boolean;
  step: {
    id: string;
    title: string;
    assigned_to?: string | null;
    assigned_employee?: {
      id: string;
      full_name: string;
      email?: string;
    };
  };
  onAssign: (employeeId: string, dueDateIso?: string | null) => void;
  onUnassign: () => void;
  onClose: () => void;
}

export const MobileAssignStepDialog = ({ open = true, step, onAssign, onUnassign, onClose }: MobileAssignStepDialogProps) => {
  const isMobile = useIsMobile();
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dueDate, setDueDate] = useState<string>('');
  const [dueTime, setDueTime] = useState<string>('23:59'); // Default time 23:59
  const [savingDue, setSavingDue] = useState<boolean>(false);
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean>(false); // Track if initial load is done
  const { toast } = useToast();
  const { organizationId } = useCurrentOrg();
  const { data: employees = [], isLoading: loading } = useAvailableEmployees();

  // Generate date options (today + next 30 days)
  const generateDateOptions = () => {
    const options: { value: string; label: string }[] = [];
    const today = new Date();
    for (let i = 0; i < 31; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const value = `${yyyy}-${mm}-${dd}`;
      const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      options.push({ value, label });
    }
    return options;
  };

  // Generate time options (00:00 to 23:59 with 15-minute intervals)
  const generateTimeOptions = () => {
    const options: string[] = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const h = String(hour).padStart(2, '0');
        const m = String(minute).padStart(2, '0');
        options.push(`${h}:${m}`);
      }
    }
    return options;
  };

  // Load current assignment and due date (if any) - only once on mount
  useEffect(() => {
    if (isInitialized) return; // Prevent re-running after initialization
    
    const loadAssignmentAndDue = async () => {
      try {
        if (!organizationId || !step?.id) {
          setIsInitialized(true);
          return;
        }
        // latest assignment for this step
        const { data: assignsRaw, error: assignError } = await supabase
          .from('task_steps_assigned')
          .select('id, assigned_at')
          .eq('task_step_id', step.id)
          .order('assigned_at', { ascending: false })
          .limit(1);
        if (assignError) {
          logger.warn('task_steps_assigned fetch error', assignError);
          setIsInitialized(true);
          return;
        }
        type AssignRow = { id: string; assigned_at: string };
        const assigns = (assignsRaw as unknown as AssignRow[] | null) ?? [];
        const assign = assigns[0];
        if (assign) {
          setActiveAssignmentId(assign.id);
          const { data: dueRowsRaw, error: dueError } = await supabase
            .from('task_steps_assigned_duedate')
            .select('due_date')
            .eq('task_steps_assigned_id', assign.id)
            .order('created_at', { ascending: false })
            .limit(1);
          if (dueError) {
            logger.warn('task_steps_assigned_duedate fetch error', dueError);
          }
          type DueRow = { due_date: string };
          const dueRows = (dueRowsRaw as unknown as DueRow[] | null) ?? [];
          const due = dueRows[0]?.due_date;
          if (due) {
            const d = new Date(due);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            setDueDate(`${yyyy}-${mm}-${dd}`);
            // Extract time from due date
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            setDueTime(`${hours}:${minutes}`);
          }
          // If no due date exists, keep default 23:59 (already set in initial state)
        } else {
          setActiveAssignmentId(null);
          // Keep default 23:59 when no assignment exists (already set in initial state)
        }
        setIsInitialized(true);
      } catch (e) {
        logger.warn('Failed to load assignment/due date', e);
        setIsInitialized(true);
      }
    };
    loadAssignmentAndDue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.id, organizationId, isInitialized]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredEmployees(employees);
    } else {
      const filtered = employees.filter(emp =>
        emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredEmployees(filtered);
    }
  }, [searchTerm, employees]);

  const resolveDueDateIso = (): string | null => {
    if (!dueDate) return null;
    // Combine date and time
    const [hours, minutes] = dueTime.split(':');
    const dateTime = new Date(dueDate);
    dateTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
    return dateTime.toISOString();
  };

  const handleAssign = (employeeId: string) => {
    onAssign(employeeId, resolveDueDateIso());
  };

  const handleUnassign = () => {
    onUnassign();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        fullscreenAnimation={isMobile}
        hideCloseButton={isMobile}
        className={cn(
          'w-full max-w-none m-0 rounded-none translate-x-0 translate-y-0 flex flex-col p-0 gap-0',
          isMobile
            ? 'fixed left-0 right-0 top-0 modal-above-safe-area'
            : 'h-full max-h-screen fixed inset-0 sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:max-w-md sm:h-auto sm:max-h-[90vh]'
        )}
      >
        <DialogHeader
          className="flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-left safe-area-top px-4 pt-4 pb-3"
        >
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <span className="lowercase truncate">Assign Step: {step.title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll px-6 pt-4 pb-6">
          {/* Current Assignment */}
          {step.assigned_to && step.assigned_employee ? (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-900">Currently Assigned To:</p>
                  <p className="text-sm text-green-700">{step.assigned_employee.full_name}</p>
                  {step.assigned_employee.email && (
                    <p className="text-xs text-green-600">{step.assigned_employee.email}</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUnassign}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Unassign
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
              <p className="text-sm text-gray-600">This step is not assigned to anyone yet.</p>
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <label htmlFor="mobile-assign-step-search-employees" className="sr-only">
              Search employees
            </label>
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              id="mobile-assign-step-search-employees"
              name="mobile-assign-step-search-employees"
              autoComplete="off"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 text-sm"
            />
          </div>

          {/* Due Date and Time (two dropdowns, autosave) */}
          <div className="space-y-2">
            <span id="mobile-assign-step-due-date-label" className="text-xs text-gray-500">Due date</span>
            <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="mobile-assign-step-due-date-label">
              {/* Date Dropdown */}
              <Select
                value={dueDate}
                onValueChange={async (val) => {
                  setDueDate(val);
                  // autosave only if an active assignment exists
                  if (!activeAssignmentId) return;
                  try {
                    setSavingDue(true);
                    // Combine date and time
                    const [hours, minutes] = dueTime.split(':');
                    const dateTime = new Date(val);
                    dateTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
                    const iso = dateTime.toISOString();
                    await supabase
                      .from('task_steps_assigned_duedate')
                      .insert({
                        organization_id: organizationId,
                        task_steps_assigned_id: activeAssignmentId,
                        due_date: iso,
                      });
                  } catch (err) {
                    logger.error('Autosave due date failed', err);
                    toast({ title: 'Error', description: 'Failed to save due date', variant: 'destructive' });
                  } finally {
                    setSavingDue(false);
                  }
                }}
              >
                <SelectTrigger id="mobile-assign-step-due-date" name="mobile-assign-step-due-date" className="h-9" aria-label="Due date">
                  <SelectValue placeholder="Select date" />
                </SelectTrigger>
                <SelectContent>
                  {generateDateOptions().map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Time Dropdown */}
              <Select
                value={dueTime || '23:59'}
                onValueChange={async (val) => {
                  setDueTime(val);
                  // autosave only if an active assignment exists
                  if (!activeAssignmentId || !dueDate) return;
                  try {
                    setSavingDue(true);
                    // Combine date and time
                    const [hours, minutes] = val.split(':');
                    const dateTime = new Date(dueDate);
                    dateTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
                    const iso = dateTime.toISOString();
                    await supabase
                      .from('task_steps_assigned_duedate')
                      .insert({
                        organization_id: organizationId,
                        task_steps_assigned_id: activeAssignmentId,
                        due_date: iso,
                      });
                  } catch (err) {
                    logger.error('Autosave due time failed', err);
                    toast({ title: 'Error', description: 'Failed to save due time', variant: 'destructive' });
                  } finally {
                    setSavingDue(false);
                  }
                }}
              >
                <SelectTrigger id="mobile-assign-step-due-time" name="mobile-assign-step-due-time" className="h-9" aria-label="Due time">
                  <SelectValue>{dueTime || '23:59'}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {generateTimeOptions().map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {savingDue && <div className="text-[10px] text-gray-400">Saving…</div>}
          </div>

          {/* Employee List */}
          <div className="max-h-[calc(100vh-400px)] sm:max-h-60 overflow-y-auto space-y-2">
            {loading ? (
              <>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="p-3 border rounded-md border-gray-200 bg-card flex items-center gap-3">
                    <Skeleton className="h-9 w-9 flex-shrink-0 rounded-full" />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                ))}
              </>
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
                    employee.id === step.assigned_to
                      ? 'bg-green-50 border-green-200'
                      : 'bg-white border-gray-200 hover:bg-blue-50 hover:border-blue-200'
                  }`}
                  onClick={() => handleAssign(employee.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{employee.full_name}</p>
                      {employee.email && (
                        <p className="text-xs text-gray-500">{employee.email}</p>
                      )}
                    </div>
                    {employee.id === step.assigned_to && (
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer - rules: px-4 pt-3 pb-3, no safe-area-padding-bottom, size="sm" */}
        <div className="px-4 pt-3 pb-3 flex-shrink-0 border-t bg-muted/30">
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="w-full sm:w-auto">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

