import { useState, useCallback } from 'react';
import { MoreHorizontal, Eye, UserX, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Employee } from '../hooks/useEmployees';
import { useToast } from '@/shared/hooks/use-toast';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { supabase } from '@/shared/lib/supabaseClient';
import { useEmployeePermissions } from '../hooks/useEmployeePermissions';
import { ConfirmationDialog } from '../modal/ConfirmationDialog';
import { logger } from '@/shared/lib/logger';

interface EmployeeActionsDropdownProps {
  employee: Employee;
  userRole?: string;
  currentUserEmail?: string;
  onRefresh?: () => void;
  onViewDetails?: () => void;
}

type ConfirmAction = 'resign' | 'delete' | null;

export const EmployeeActionsDropdown = ({ 
  employee, 
  userRole,
  currentUserEmail,
  onRefresh,
  onViewDetails
}: EmployeeActionsDropdownProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const { toast } = useToast();
  const { t } = useAppTranslation();

  const countDirectReports = useCallback(async (): Promise<number> => {
    const { count, error } = await supabase
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('manager_id', employee.id);
    if (error) {
      logger.error('countDirectReports', error);
      return 0;
    }
    return count ?? 0;
  }, [employee.id]);

  // Get centralized permissions
  const permissions = useEmployeePermissions({
    employee,
    userRole,
    currentUserEmail
  });

  // Debug logging (only in development)
  logger.debug('EmployeeActionsDropdown - Employee', {
    employeeName: employee.full_name,
    employeeEmail: employee.email,
    currentUserEmail,
    userRole,
    isOwner: employee.is_organization_owner,
    isSelf: permissions.isSelf
  });

  logger.debug('EmployeeActionsDropdown - Permissions', permissions);

  const handleViewDetails = useCallback(() => {
    onViewDetails?.();
  }, [onViewDetails]);

  const handleResignConfirm = useCallback(async () => {
    setIsLoading(true);
    try {
      const reports = await countDirectReports();
      if (reports > 0) {
        toast({
          title: 'Cannot resign',
          description: t('employees.resign.blockedHasDirectReports', 'Reassign direct reports first.', { count: reports }),
          variant: 'destructive',
        });
        setConfirmAction(null);
        return;
      }

      logger.info('Starting resign process for employee:', employee.full_name);
      
      // Call the edge function to deactivate organization access and update employee status
      const { data: result, error } = await supabase.functions.invoke('revoke-user-sessions', {
        body: {
          userId: employee.user_id,
          employeeId: employee.id,
          reason: 'Manual resign by admin/owner'
        }
      });

      if (error) {
        logger.error('Error calling revoke-user-sessions function:', error);
        
        // Provide more specific error messages
        let errorMessage = 'Failed to resign employee. Please try again.';
        
        if (error.message?.includes('Permission denied')) {
          errorMessage = 'You do not have permission to resign this employee.';
        } else if (error.message?.includes('not found')) {
          errorMessage = 'Employee not found or not in your organization.';
        } else if (error.message?.includes('owner')) {
          errorMessage = 'Organization owners cannot be resigned. Transfer ownership first.';
        } else if (error.message?.includes('configuration')) {
          errorMessage = 'Server configuration error. Please contact support.';
        }
        
        throw new Error(errorMessage);
      }

      if (!result?.success) {
        const errorMsg = result?.error || 'Unknown error occurred during resignation';
        logger.error('Resignation failed:', errorMsg);
        throw new Error(errorMsg);
      }

      logger.info('Employee resigned successfully:', result);

      toast({
        title: "Employee Resigned",
        description: result.message || `${employee.full_name} has been resigned from this organization`,
      });
      
      onRefresh?.();
    } catch (error: any) {
      logger.error('Error resigning employee:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to resign employee. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [employee, onRefresh, toast, countDirectReports, t]);

  const handleDeleteConfirm = useCallback(async () => {
    setIsLoading(true);
    try {
      const reports = await countDirectReports();
      if (reports > 0) {
        toast({
          title: 'Cannot delete',
          description: t('employees.resign.blockedHasDirectReports', 'Reassign direct reports first.', { count: reports }),
          variant: 'destructive',
        });
        setConfirmAction(null);
        return;
      }

      logger.info('Deleting employee:', employee.full_name);

      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', employee.id);

      if (error) throw error;

      logger.info('Employee deleted successfully');

      toast({
        title: "Employee Deleted",
        description: `${employee.full_name} has been permanently deleted`,
      });
      
      onRefresh?.();
    } catch (error: any) {
      logger.error('Error deleting employee:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete employee",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [employee, onRefresh, toast, countDirectReports, t]);

  const handleResign = useCallback(async () => {
    if (!permissions.canResign) {
      toast({
        title: "Cannot Resign Employee",
        description: permissions.reasons.cannotResign || "You don't have permission to resign this employee",
        variant: "destructive",
      });
      return;
    }
    const reports = await countDirectReports();
    if (reports > 0) {
      toast({
        title: 'Cannot resign',
        description: t('employees.resign.blockedHasDirectReports', 'Reassign direct reports first.', { count: reports }),
        variant: 'destructive',
      });
      return;
    }
    setConfirmAction('resign');
  }, [permissions, toast, countDirectReports, t]);

  const handleDelete = useCallback(async () => {
    if (!permissions.canDelete) {
      toast({
        title: "Cannot Delete Employee",
        description: permissions.reasons.cannotDelete || "You don't have permission to delete this employee",
        variant: "destructive",
      });
      return;
    }
    const reports = await countDirectReports();
    if (reports > 0) {
      toast({
        title: 'Cannot delete',
        description: t('employees.resign.blockedHasDirectReports', 'Reassign direct reports first.', { count: reports }),
        variant: 'destructive',
      });
      return;
    }
    setConfirmAction('delete');
  }, [permissions, toast, countDirectReports, t]);

  const handleConfirmAction = useCallback(() => {
    if (confirmAction === 'resign') {
      handleResignConfirm();
    } else if (confirmAction === 'delete') {
      handleDeleteConfirm();
    }
  }, [confirmAction, handleResignConfirm, handleDeleteConfirm]);

  // Confirmation dialog messages
  const getConfirmationContent = () => {
    if (confirmAction === 'resign') {
      return {
        title: "Resign Employee",
        description: (
          <div className="space-y-2">
            <p>Are you sure you want to resign <strong>{employee.full_name}</strong>?</p>
            <p className="text-sm">This action will:</p>
            <ul className="text-sm list-disc list-inside space-y-1">
              <li>Deactivate their access to this organization</li>
              <li>Set their employee status to inactive</li>
              <li>They will retain access to organizations they own</li>
              <li>They can still log in with their existing credentials</li>
            </ul>
            <p className="text-sm font-semibold text-orange-600 mt-2">
              This action cannot be undone automatically.
            </p>
          </div>
        ),
        confirmLabel: "Yes, Resign",
        variant: 'destructive' as const
      };
    } else if (confirmAction === 'delete') {
      return {
        title: "Delete Employee",
        description: (
          <div className="space-y-2">
            <p>Are you sure you want to permanently delete <strong>{employee.full_name}</strong>?</p>
            <p className="text-sm font-semibold text-red-600">
              This action cannot be undone.
            </p>
          </div>
        ),
        confirmLabel: "Yes, Delete",
        variant: 'destructive' as const
      };
    }
    return { title: '', description: '', confirmLabel: '', variant: 'default' as const };
  };

  const confirmContent = getConfirmationContent();

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-gray-600 hover:text-gray-900" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <MoreHorizontal className="h-3 w-3" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={4}
          className="z-[100] w-48 border border-gray-200 bg-white p-1 text-slate-700 shadow-md dark:border-border dark:bg-popover dark:text-popover-foreground"
        >
          <DropdownMenuItem
            onClick={handleViewDetails}
            className="cursor-pointer text-slate-700 focus:bg-slate-100 focus:text-slate-700 dark:text-foreground dark:focus:bg-accent dark:focus:text-foreground"
          >
            <Eye className="mr-2 h-4 w-4 text-slate-700 dark:text-foreground" />
            View Details
          </DropdownMenuItem>

          {permissions.canResign && (
            <DropdownMenuItem
              onClick={handleResign}
              className="cursor-pointer text-orange-600 focus:text-orange-600"
              disabled={isLoading}
            >
              <UserX className="mr-2 h-4 w-4 text-orange-600" />
              Resign
            </DropdownMenuItem>
          )}

          {permissions.canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDelete}
                className="cursor-pointer text-red-600 focus:text-red-600"
                disabled={isLoading}
              >
                <Trash2 className="mr-2 h-4 w-4 text-red-600" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmationDialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={confirmContent.title}
        description={confirmContent.description}
        confirmLabel={confirmContent.confirmLabel}
        cancelLabel="Cancel"
        onConfirm={handleConfirmAction}
        variant={confirmContent.variant}
      />
    </>
  );
};
