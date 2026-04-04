import React, { useState, useEffect } from 'react';
import { User, Search, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { useAvailableEmployees } from '@/shared/hooks/useAvailableEmployees';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { formatDateTime } from '@/shared/utils/dateFormatter';
import { devLog } from '@/shared/lib/logger';
import { isEmployeeActive } from '@/2-1-employees/utils/employeeUtils';

interface AssignSocialMediaPlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssign: (assignment: { employeeId: string; assignedAt: string }) => void;
  dueDate: string | null; // Due date from post_date in social_media_plans
  taskTitle: string;
  disabledReason?: string; // when present, disable assign and show message
}

export const AssignSocialMediaPlanModal: React.FC<AssignSocialMediaPlanModalProps> = ({
  open,
  onOpenChange,
  onAssign,
  dueDate,
  taskTitle,
  disabledReason
}) => {
  const { data: employees = [], isLoading: loadingEmployees } = useAvailableEmployees();
  const { data: currentEmployee } = useCurrentEmployee();
  const { organizationId } = useCurrentOrg();
  
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  
  // useAvailableEmployees already applies isEmployeeActive (employee_status_name, pending_removal, legacy status).
  // Do not filter on employees.status here — that field is no longer selected and would be undefined for everyone.
  const filteredEmployees = React.useMemo(() => {
    if (!searchTerm.trim()) return employees;
    const searchLower = searchTerm.toLowerCase();
    return employees.filter(
      (emp) =>
        emp.full_name?.toLowerCase().includes(searchLower) ||
        emp.email?.toLowerCase().includes(searchLower)
    );
  }, [employees, searchTerm]);
  
  // Initialize state when modal opens
  useEffect(() => {
    if (open) {
      setSelectedEmployeeId('');
      setSearchTerm('');
      setShowConfirmation(false);
    }
  }, [open]);
  
  // Get selected employee details
  const selectedEmployee = React.useMemo(() => {
    return employees.find(emp => emp.id === selectedEmployeeId);
  }, [employees, selectedEmployeeId]);
  
  // Get today's date for assignment (default)
  const getTodayAssignedAt = () => {
    const now = new Date();
    return now.toISOString();
  };
  
  // Validate assigned date <= due date (using today's date)
  const isDateValid = React.useMemo(() => {
    if (!dueDate) return true; // If no due date, allow any date
    
    const assignedDate = new Date();
    assignedDate.setHours(0, 0, 0, 0);
    
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    
    return assignedDate <= due;
  }, [dueDate]);
  
  // Check if selected employee is same as current employee
  const isSelfAssignment = React.useMemo(() => {
    return selectedEmployeeId === currentEmployee?.id;
  }, [selectedEmployeeId, currentEmployee]);
  
  // Handle assign button click
  const handleAssignClick = () => {
    if (disabledReason) return;
    if (!selectedEmployeeId) {
      toast.error('Please select an employee');
      return;
    }
    
    if (!isDateValid) {
      toast.error('Assignment date cannot be after due date');
      return;
    }
    
    // Skip if self-assignment
    if (isSelfAssignment) {
      toast.info('Selected employee is the same as active profile. Skipping assignment.');
      onOpenChange(false);
      return;
    }
    
    const employee = employees.find((emp) => emp.id === selectedEmployeeId);
    if (employee && !isEmployeeActive(employee)) {
      toast.error('Selected employee is not active');
      return;
    }
    
    // Show confirmation dialog
    setShowConfirmation(true);
  };
  
  // Handle confirmation
  const handleConfirm = () => {
    if (disabledReason) return;
    if (!selectedEmployeeId) return;
    
    setIsAssigning(true);
    
    try {
      // Use today's date and time for assigned_at
      const assignedAtISO = getTodayAssignedAt();
      
      // Call onAssign callback
      onAssign({
        employeeId: selectedEmployeeId,
        assignedAt: assignedAtISO
      });
      
      setShowConfirmation(false);
      onOpenChange(false);
    } catch (error) {
      devLog.error('Error assigning:', error);
      toast.error('Failed to assign task step');
    } finally {
      setIsAssigning(false);
    }
  };
  
  // Handle auto-assign (when no employee is selected)
  const handleAutoAssign = () => {
    if (disabledReason) return;
    if (!currentEmployee) {
      toast.error('Current employee not found');
      return;
    }
    
    setIsAssigning(true);
    
    try {
      const assignedAtISO = getTodayAssignedAt();
      
      // Call onAssign callback with current employee
      onAssign({
        employeeId: currentEmployee.id,
        assignedAt: assignedAtISO
      });
      
      onOpenChange(false);
    } catch (error) {
      devLog.error('Error auto-assigning:', error);
      toast.error('Failed to assign task step');
    } finally {
      setIsAssigning(false);
    }
  };
  
  // Format due date for display
  const formattedDueDate = React.useMemo(() => {
    if (!dueDate) return 'No due date';
    return formatDateTime(dueDate);
  }, [dueDate]);
  
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0 overflow-hidden" style={{ display: 'flex' }}>
          <div className="flex flex-col h-full max-h-[80vh] w-full">
            <DialogHeader className="sticky top-0 bg-white z-10 pb-4 border-b px-6 pt-6 flex-shrink-0 w-full">
              <DialogTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                Assign Social Media Plan
              </DialogTitle>
              <DialogDescription>
                Assign this task step to an employee
              </DialogDescription>
            </DialogHeader>
          
          {disabledReason && (
            <div className="px-6 py-3 text-xs text-amber-700 bg-amber-50 border-y border-amber-200">
              {disabledReason}
            </div>
          )}
            
            <div className="flex-1 overflow-y-auto seamless-scroll space-y-4 mt-4 px-6 min-h-0 w-full">
            {/* Task Title Info */}
            <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
              <div className="text-xs font-medium text-gray-500 mb-1">
                Task Step
              </div>
              <div className="text-sm font-medium text-gray-900 line-clamp-2">
                {taskTitle}
              </div>
            </div>
            
            {/* Due Date Info */}
            {dueDate && (
              <div className="rounded-lg bg-blue-50 p-3 border border-blue-200">
                <div className="text-xs font-medium text-blue-600 mb-1">
                  Due Date
                </div>
                <div className="text-sm text-blue-900">
                  {formattedDueDate}
                </div>
              </div>
            )}
            
            {/* Employee Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assign To <span className="text-red-500">*</span>
              </label>
              
              {/* Search Input */}
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {/* Employee List */}
              <div className="border rounded-lg max-h-48 overflow-y-auto seamless-scroll">
                {loadingEmployees ? (
                  <div className="flex items-center justify-center p-4">
                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="ml-2 text-sm text-gray-500">Loading employees...</span>
                  </div>
                ) : filteredEmployees.length === 0 ? (
                  <div className="text-center p-4">
                    <User className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">
                      {employees.length === 0
                        ? 'No active employees found'
                        : 'No employees match your search'}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredEmployees.map((employee) => (
                      <div
                        key={employee.id}
                        onClick={() => setSelectedEmployeeId(employee.id)}
                        className={`p-3 cursor-pointer transition-colors ${
                          selectedEmployeeId === employee.id
                            ? 'bg-blue-50 border-l-4 border-blue-500'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              selectedEmployeeId === employee.id
                                ? 'border-blue-500 bg-blue-500'
                                : 'border-gray-300'
                            }`}>
                              {selectedEmployeeId === employee.id && (
                                <div className="w-2 h-2 rounded-full bg-white" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {employee.full_name}
                                {employee.id === currentEmployee?.id && (
                                  <span className="ml-2 text-xs text-blue-600">(You)</span>
                                )}
                              </p>
                              {employee.email && (
                                <p className="text-xs text-gray-500">{employee.email}</p>
                              )}
                            </div>
                          </div>
                          {isEmployeeActive(employee) && (
                            <span className="text-xs text-green-600 font-medium">Active</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Auto-assign option */}
              <div className="mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleAutoAssign}
                  className="w-full text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  disabled={isAssigning || !!disabledReason}
                >
                  <User className="w-4 h-4 mr-2" />
                  Auto-assign to me
                </Button>
              </div>
            </div>
            
            {/* Validation message for date */}
            {!isDateValid && dueDate && (
              <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 p-2 rounded border border-red-200">
                <AlertCircle className="w-4 h-4" />
                <span>Today's date cannot be after due date ({formattedDueDate})</span>
              </div>
            )}
          </div>
          
          {/* Action Buttons - Sticky */}
          <div className="sticky bottom-0 bg-white border-t pt-4 pb-4 px-6 flex-shrink-0 w-full flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isAssigning}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignClick}
              disabled={!!disabledReason || !selectedEmployeeId || !isDateValid || isAssigning}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isAssigning ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Assigning...
                </>
              ) : (
                <>
                  <User className="w-4 h-4 mr-2" />
                  Assign
                </>
              )}
            </Button>
          </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Assignment</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <span className="block">Please confirm the following assignment details:</span>
            </AlertDialogDescription>
            <div className="bg-gray-50 p-3 rounded-lg space-y-2 text-sm mt-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <span className="font-medium">Employee:</span>
                <span>{selectedEmployee?.full_name || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Assignment Date:</span>
                <span>{formatDateTime(getTodayAssignedAt())}</span>
              </div>
              {dueDate && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">Due Date:</span>
                  <span>{formattedDueDate}</span>
                </div>
              )}
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isAssigning}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isAssigning}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isAssigning ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Assigning...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Confirm Assignment
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

