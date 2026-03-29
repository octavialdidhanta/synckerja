import React, { useState, useEffect } from 'react';
import { Users, X, Search } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/components/ui/use-toast';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useAvailableEmployees } from '@/shared/hooks/useAvailableEmployees';

interface Employee {
  id: string;
  full_name: string;
  email?: string;
  status?: string;
}

interface AssignStepDialogProps {
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

export const AssignStepDialog = ({ step, onAssign, onUnassign, onClose }: AssignStepDialogProps) => {
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dueDate, setDueDate] = useState<string>('');
  const [savingDue, setSavingDue] = useState<boolean>(false);
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const { toast } = useToast();
  const { organizationId } = useCurrentOrg();
  const { data: employees = [], isLoading: loading } = useAvailableEmployees();

  // Load current assignment and due date (if any)
  useEffect(() => {
    const loadAssignmentAndDue = async () => {
      try {
        if (!organizationId || !step?.id) return;
        // latest assignment for this step
        const { data: assigns } = await supabase
          .from('task_steps_assigned')
          .select('id, assigned_at')
          .eq('task_step_id', step.id)
          .order('assigned_at', { ascending: false })
          .limit(1);
        const assign = (assigns || [])[0];
        if (assign) {
          setActiveAssignmentId(assign.id);
          const { data: dueRows } = await supabase
            .from('task_steps_assigned_duedate')
            .select('due_date')
            .eq('task_steps_assigned_id', assign.id)
            .order('created_at', { ascending: false })
            .limit(1);
          const due = (dueRows || [])[0]?.due_date as string | undefined;
          if (due) {
            const d = new Date(due);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            setDueDate(`${yyyy}-${mm}-${dd}`);
          }
        } else {
          setActiveAssignmentId(null);
        }
      } catch (e) {
        console.warn('Failed to load assignment/due date', e);
      }
    };
    loadAssignmentAndDue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.id, organizationId]);

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
    return dueDate ? new Date(dueDate).toISOString() : null;
  };

  const handleAssign = (employeeId: string) => {
    // Validasi: due date harus dipilih terlebih dahulu
    if (!dueDate) {
      toast({
        title: 'Due Date Required',
        description: 'Please select a due date before assigning an employee.',
        variant: 'destructive'
      });
      return;
    }
    onAssign(employeeId, resolveDueDateIso());
  };

  const handleUnassign = () => {
    onUnassign();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        className="w-[620px] max-w-[90vw] max-h-[90vh] h-[600px] p-0 flex flex-col"
        aria-describedby="assign-step-description"
      >
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-xl font-semibold truncate">
                Assign Step
              </DialogTitle>
              <DialogDescription id="assign-step-description" className="text-sm text-muted-foreground mt-1 truncate">
                {step.title}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5 seamless-scroll max-h-[calc(100vh-120px)]">
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
          <div className="space-y-2">
            <label htmlFor="assign-step-search-employees" className="text-sm font-medium text-gray-700">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="assign-step-search-employees"
                name="assign-step-search-employees"
                autoComplete="off"
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Due Date (single field, autosave) */}
          <div className="space-y-2">
            <label htmlFor="assign-step-due-date" className="text-sm font-medium text-gray-700">
              Due date <span className="text-red-500">*</span>
            </label>
            <Input
              id="assign-step-due-date"
              name="assign-step-due-date"
              type="date"
              className="h-10 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={dueDate}
              onChange={async (e) => {
                const val = e.target.value;
                setDueDate(val);
                // autosave only if an active assignment exists
                if (!activeAssignmentId) return;
                try {
                  setSavingDue(true);
                  // store as append-only (latest wins)
                  const iso = val ? new Date(val).toISOString() : null;
                  if (iso) {
                    await supabase
                      .from('task_steps_assigned_duedate')
                      .insert({
                        organization_id: organizationId,
                        task_steps_assigned_id: activeAssignmentId,
                        due_date: iso,
                      });
                  }
                } catch (err) {
                  console.error('Autosave due date failed', err);
                  toast({ title: 'Error', description: 'Failed to save due date', variant: 'destructive' });
                } finally {
                  setSavingDue(false);
                }
              }}
            />
            {savingDue && <div className="text-[10px] text-gray-400 mt-1">Saving…</div>}
            {!dueDate && (
              <p className="text-xs text-amber-600 mt-1">
                ⚠️ Please select a due date before assigning an employee
              </p>
            )}
          </div>

          {/* Employee List */}
          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
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
              filteredEmployees.map((employee) => {
                const isDisabled = !dueDate && employee.id !== step.assigned_to;
                return (
                  <div
                    key={employee.id}
                    className={`p-3 border rounded-md transition-colors ${
                      employee.id === step.assigned_to
                        ? 'bg-green-50 border-green-200'
                        : isDisabled
                        ? 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'
                        : 'bg-white border-gray-200 hover:bg-blue-50 hover:border-blue-200 cursor-pointer'
                    }`}
                    onClick={() => !isDisabled && handleAssign(employee.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-sm font-medium ${isDisabled ? 'text-gray-400' : 'text-gray-900'}`}>
                          {employee.full_name}
                        </p>
                        {employee.email && (
                          <p className={`text-xs ${isDisabled ? 'text-gray-400' : 'text-gray-500'}`}>
                            {employee.email}
                          </p>
                        )}
                      </div>
                      {employee.id === step.assigned_to && (
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="px-6 pb-6 pt-4 flex-shrink-0 border-t bg-muted/30 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

