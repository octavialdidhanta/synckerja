import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

export const useExpenseMetrics = () => {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ['expense-metrics', organizationId],
    queryFn: async () => {
      if (!organizationId) return null;

      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();
      const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;

      const pad = (m: number) => m.toString().padStart(2, '0');
      const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
      const nextMonthYear = currentMonth === 12 ? currentYear + 1 : currentYear;
      const prevNextMonth = previousMonth === 12 ? 1 : previousMonth + 1;
      const prevNextMonthYear = previousMonth === 12 ? previousYear + 1 : previousYear;

      const { data: currentMonthData, error: currentError } = await supabase
        .from('expenses')
        .select('amount, status')
        .eq('organization_id', organizationId)
        .eq('status', 'active')
        .gte('create_date', `${currentYear}-${pad(currentMonth)}-01`)
        .lt('create_date', `${nextMonthYear}-${pad(nextMonth)}-01`);

      if (currentError) throw currentError;

      const { data: previousMonthData, error: previousError } = await supabase
        .from('expenses')
        .select('amount, status')
        .eq('organization_id', organizationId)
        .eq('status', 'active')
        .gte('create_date', `${previousYear}-${pad(previousMonth)}-01`)
        .lt('create_date', `${prevNextMonthYear}-${pad(prevNextMonth)}-01`);

      if (previousError) throw previousError;

      const { data: yearData, error: yearError } = await supabase
        .from('expenses')
        .select('amount, status')
        .eq('organization_id', organizationId)
        .eq('status', 'active')
        .gte('create_date', `${currentYear}-01-01`)
        .lt('create_date', `${currentYear + 1}-01-01`);

      if (yearError) throw yearError;

      const { count: totalTransactions, error: countError } = await supabase
        .from('expenses')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('status', 'active');

      if (countError) throw countError;

      const sumAmount = (rows: { amount: number | string }[] | null) =>
        rows?.reduce((s, row) => s + parseFloat(String(row.amount)), 0) ?? 0;

      const currentMonthTotal = sumAmount(currentMonthData);
      const previousMonthTotal = sumAmount(previousMonthData);
      const yearTotal = sumAmount(yearData);

      const growthPercentage =
        previousMonthTotal > 0
          ? ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100
          : currentMonthTotal > 0
            ? 100
            : 0;

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
