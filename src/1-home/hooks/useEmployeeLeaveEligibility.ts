import { useQuery } from '@tanstack/react-query';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { useEmployeeLeaveBalance } from '@/2-1-employees/MyInfo/LeavePermit/hooks/useEmployeeLeaveBalance';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { applyVariables } from '@/shared/i18n/translations';

export interface LeaveEligibility {
  isEligible: boolean;
  reason?: string;
  remainingDays: number;
  annualLeaveEntitlement: number;
  message?: string;
  strategy?: string;
  eligibilityDate?: Date;
}

export const useEmployeeLeaveEligibility = (employeeId?: string | null) => {
  const { t } = useAppTranslation();
  const { data: currentEmployee } = useCurrentEmployee();
  const effectiveEmployeeId = employeeId || currentEmployee?.id;
  
  // Use the existing leave balance hook
  const { data: leaveBalance, isLoading: balanceLoading } = useEmployeeLeaveBalance();

  return useQuery({
    queryKey: ['employeeLeaveEligibility', effectiveEmployeeId],
    queryFn: async (): Promise<LeaveEligibility> => {
      if (!effectiveEmployeeId) {
        throw new Error('No employee ID provided');
      }

      // Use data from leave balance if available
      if (leaveBalance) {
        const remainingDays = leaveBalance.remainingLeave || 0;
        const annualEntitlement = leaveBalance.totalAnnualLeave || 12;
        
        // Check if employee is eligible for leave
        const isEligible = remainingDays > 0;
        
        return {
          isEligible,
          remainingDays,
          annualLeaveEntitlement: annualEntitlement,
          message: isEligible 
            ? applyVariables(t('leaveEligibility.hasRemainingLeave', 'You have {{days}} days of leave remaining'), { days: String(remainingDays) })
            : t('leaveEligibility.noRemainingLeave', 'You do not have any remaining leave available'),
          strategy: 'after_probation',
          eligibilityDate: currentEmployee?.join_date ? new Date(currentEmployee.join_date) : undefined
        };
      }

      // Fallback to basic eligibility check
      const joinDate = currentEmployee?.join_date || currentEmployee?.hire_date;
      const isEligible = joinDate ? new Date(joinDate) < new Date() : false;
      
      return {
        isEligible,
        remainingDays: 12,
        annualLeaveEntitlement: 12,
        message: isEligible 
          ? t('leaveEligibility.eligibleToRequest', 'You are eligible to request leave') 
          : t('leaveEligibility.notEligibleToRequest', 'You are not yet eligible to request leave'),
        strategy: 'after_probation',
        eligibilityDate: joinDate ? new Date(joinDate) : undefined
      };
    },
    enabled: !!effectiveEmployeeId && !balanceLoading,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
