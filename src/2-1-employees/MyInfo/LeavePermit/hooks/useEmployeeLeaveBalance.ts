import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { logger } from '@/shared/lib/logger';

/** Default annual entitlement when no policy / RPC (matches DB RPC default). */
const DEFAULT_ANNUAL_LEAVE_DAYS = 12;

// Type definition for the RPC function result
interface LeaveBalanceResult {
  total_allocated: number;
  total_used: number;
  remaining_balance: number;
  expired_days: number;
  calculation_date: string;
}

export const useEmployeeLeaveBalance = () => {
  const { data: employeeData } = useCurrentEmployee();
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ['employee-leave-balance', employeeData?.id],
    queryFn: async () => {
      if (!employeeData?.id) {
        throw new Error('No employee found');
      }

      logger.query('ðŸ“Š Fetching leave balance for employee:', employeeData.id);
      logger.query('ðŸ“Š Employee organization:', employeeData.organization_id);
      logger.query('ðŸ“Š Employee current leave_balance:', employeeData.leave_balance);

      try {
        // Always calculate using the updated RPC function for accurate data
        logger.query('ðŸ“Š Calculating leave balance for employee:', employeeData.id);
        
        const { data: balanceResult, error: balanceError } = await supabase
          .rpc('calculate_employee_leave_balance', {
            employee_id_param: employeeData.id
          });

        if (!balanceError && balanceResult) {
          logger.query('âœ… Leave balance calculated successfully:', balanceResult);
          const result = balanceResult as unknown as LeaveBalanceResult;
          return {
            totalAnnualLeave: result.total_allocated,
            usedLeaveDays: result.total_used,
            remainingLeave: result.remaining_balance,
            expiredDays: result.expired_days,
            calculationDate: result.calculation_date
          };
        }

        console.error('âŒ Error calculating leave balance:', balanceError);
        throw balanceError || new Error('Failed to calculate leave balance');
      } catch (error) {
        console.warn('âš ï¸ Falling back to legacy calculation method');
        
        // Fallback to legacy calculation if new method fails
        const currentYear = new Date().getFullYear();
        const startOfYear = `${currentYear}-01-01`;
        const endOfYear = `${currentYear}-12-31`;

        const { data: leaveRequests, error: requestsError } = await supabase
          .from('leave_requests')
          .select('total_days, leave_type')
          .eq('employee_id', employeeData.id)
          .eq('status', 'approved')
          .gte('start_date', startOfYear)
          .lte('end_date', endOfYear);

        if (requestsError) {
          console.error('âŒ Error fetching leave requests:', requestsError);
          throw requestsError;
        }

        const usedLeaveDays = leaveRequests?.reduce((total, leave) => {
          return total + (leave.total_days || 0);
        }, 0) || 0;

        const totalAnnualLeave = DEFAULT_ANNUAL_LEAVE_DAYS;
        const remainingLeave = Math.max(0, totalAnnualLeave - usedLeaveDays);

        logger.query('âœ… Legacy leave balance calculated:', { usedLeaveDays, remainingLeave, totalAnnualLeave });
        
        return {
          totalAnnualLeave,
          usedLeaveDays,
          remainingLeave,
          expiredDays: 0,
          calculationDate: new Date().toISOString().split('T')[0]
        };
      }
    },
    enabled: !!employeeData?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

