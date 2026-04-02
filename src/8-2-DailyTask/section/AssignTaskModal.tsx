import React, { useState, useEffect } from 'react';
import { User, Calendar, X, Building2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { useAvailableEmployees } from '@/shared/hooks/useAvailableEmployees';
import { DueDatePicker } from './DueDatePicker';
import { supabase } from '@/shared/lib/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useIsMobile } from '@/mobile/hooks/use-mobile';
import { cn } from '@/shared/lib/utils';

interface AssignTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssign: (assignment: { employeeId: string | null; deadline: string | null }) => void;
  currentAssignment?: { employeeId: string | null; deadline: string | null };
}

export const AssignTaskModal: React.FC<AssignTaskModalProps> = ({
  open,
  onOpenChange,
  onAssign,
  currentAssignment
}) => {
  const { data: employees = [] } = useAvailableEmployees();
  const { organizationId } = useCurrentOrg();
  const isMobile = useIsMobile();
  const [selectedEmployee, setSelectedEmployee] = useState<string>(
    currentAssignment?.employeeId || 'unassigned'
  );
  const [deadline, setDeadline] = useState<string>(currentAssignment?.deadline || '');
  const [departmentId, setDepartmentId] = useState<string>('');

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

  // Reset state when modal opens with new current assignment
  React.useEffect(() => {
    if (open) {
      setSelectedEmployee(currentAssignment?.employeeId || 'unassigned');
      setDeadline(currentAssignment?.deadline || '');
      setDepartmentId('');
    }
  }, [open, currentAssignment]);

  // Auto-select department when employee is selected
  useEffect(() => {
    const loadEmployeeDepartment = async () => {
      if (selectedEmployee && selectedEmployee !== 'unassigned') {
        const { data: employee } = await supabase
          .from('employees')
          .select('department_id')
          .eq('id', selectedEmployee)
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
  }, [selectedEmployee]);

  const handleSubmit = () => {
    onAssign({
      employeeId: selectedEmployee === 'unassigned' ? null : selectedEmployee,
      deadline: deadline || null
    });
    onOpenChange(false);
  };

  const handleClear = () => {
    setSelectedEmployee('unassigned');
    setDeadline('');
    setDepartmentId('');
  };

  const hasChanges = selectedEmployee !== 'unassigned' || deadline !== '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'p-0 gap-0 flex flex-col',
          isMobile
            ? 'fixed left-0 right-0 top-0 translate-x-0 translate-y-0 w-full max-w-none max-h-none rounded-none modal-above-safe-area'
            : 'max-w-md max-h-[90vh]'
        )}
        hideCloseButton={isMobile}
        fullscreenAnimation={isMobile}
      >
        <DialogHeader
          className={cn(
            'flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-left safe-area-top',
            isMobile ? 'px-4 pt-4 pb-3' : 'px-6 pt-6 pb-4'
          )}
        >
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            Assign Task
          </DialogTitle>
        </DialogHeader>

        <div
          className={cn(
            'flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll space-y-4',
            isMobile ? 'px-6 pt-4 pb-6' : 'px-6 pt-4 pb-4'
          )}
        >
          {/* Employee Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assign To <span className="text-red-500">*</span>
            </label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="border border-gray-200 rounded-lg">
                <SelectValue>
                  {selectedEmployee && selectedEmployee !== 'unassigned' ? (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-600" />
                      <span className="text-sm">
                        {employees.find(e => e.id === selectedEmployee)?.full_name || 'Select...'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-500 text-sm">Unassigned</span>
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

          {/* Department Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Department
            </label>
            <Select
              value={departmentId || ''}
              onValueChange={setDepartmentId}
              disabled={!selectedEmployee || selectedEmployee === 'unassigned'}
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

          {/* Deadline Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Deadline (Optional)
            </label>
            <DueDatePicker value={deadline} onChange={setDeadline} />
            {deadline && (
              <p className="text-xs text-gray-500 mt-1">
                Due: {new Date(deadline).toLocaleDateString('id-ID', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            )}
          </div>
        </div>

        {/* Footer - rules: px-4 pt-3 pb-3, no safe-area-padding-bottom, size="sm", primary = variant default */}
        <div className={cn('px-4 pt-3 pb-3 flex-shrink-0 border-t bg-muted/30', isMobile ? '' : 'px-6 pt-4 pb-4')}>
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={!hasChanges}
              className="text-gray-600"
            >
              <X className="w-4 h-4 mr-2" />
              Clear
            </Button>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSubmit}
                className="min-w-[120px] flex items-center justify-center gap-1.5"
              >
                <User className="w-4 h-4" />
                Assign
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};




