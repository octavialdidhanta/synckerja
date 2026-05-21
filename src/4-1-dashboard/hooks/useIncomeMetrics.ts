
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

export const useIncomeMetrics = () => {
  const { organizationId } = useCurrentOrg();
  
  return useQuery({
    queryKey: ['income-metrics', organizationId],
    queryFn: async () => {
      if (!organizationId) return null;

      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();
      const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;

      // Get current month transactions
      const { data: currentMonthData, error: currentError } = await supabase
        .from('income_transactions')
        .select('amount, status')
        .eq('organization_id', organizationId)
        .gte('transaction_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
        .lt('transaction_date', `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`)
        .eq('status', 'completed');

      if (currentError) throw currentError;

      // Get previous month transactions
      const { data: previousMonthData, error: previousError } = await supabase
        .from('income_transactions')
        .select('amount, status')
        .eq('organization_id', organizationId)
        .gte('transaction_date', `${previousYear}-${previousMonth.toString().padStart(2, '0')}-01`)
        .lt('transaction_date', `${previousYear}-${currentMonth.toString().padStart(2, '0')}-01`)
        .eq('status', 'completed');

      if (previousError) throw previousError;

      // Get this year's data
      const { data: yearData, error: yearError } = await supabase
        .from('income_transactions')
        .select('amount, status')
        .eq('organization_id', organizationId)
        .gte('transaction_date', `${currentYear}-01-01`)
        .lt('transaction_date', `${currentYear + 1}-01-01`)
        .eq('status', 'completed');

      if (yearError) throw yearError;

      // Get total transactions count
      const { count: totalTransactions, error: countError } = await supabase
        .from('income_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('status', 'completed');

      if (countError) throw countError;

      // Calculate metrics
      const currentMonthTotal = currentMonthData?.reduce((sum, item) => sum + parseFloat(item.amount.toString()), 0) || 0;
      const previousMonthTotal = previousMonthData?.reduce((sum, item) => sum + parseFloat(item.amount.toString()), 0) || 0;
      const yearTotal = yearData?.reduce((sum, item) => sum + parseFloat(item.amount.toString()), 0) || 0;

      // Calculate growth percentage
      const growthPercentage = previousMonthTotal > 0 
        ? ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100 
        : currentMonthTotal > 0 ? 100 : 0;

      return {
        currentMonthTotal,
        previousMonthTotal,
        yearTotal,
        totalTransactions: totalTransactions || 0,
        growthPercentage,
        currentMonthTransactionCount: currentMonthData?.length || 0,
      };
    },
    enabled: !!organizationId,
  });
};
