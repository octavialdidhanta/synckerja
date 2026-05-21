import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

export const useMonthlyIncomeData = (year?: string) => {
  const { organizationId } = useCurrentOrg();
  const selectedYear = year || new Date().getFullYear().toString();
  
  return useQuery({
    queryKey: ['monthly-income-data', organizationId, selectedYear],
    queryFn: async () => {
      if (!organizationId) return [];

      // Get all months data for the selected year
      const { data, error } = await supabase
        .from('income_transactions')
        .select('transaction_date, amount, status')
        .eq('organization_id', organizationId)
        .gte('transaction_date', `${selectedYear}-01-01`)
        .lt('transaction_date', `${parseInt(selectedYear) + 1}-01-01`)
        .eq('status', 'completed');

      if (error) throw error;

      // Initialize all 12 months with zero values
      const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
        'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
      ];

      const monthlyData = months.map((month, index) => ({
        month: `${month} ${selectedYear}`,
        shortMonth: month,
        value: 0,
        count: 0
      }));

      // Group transactions by month and sum amounts
      data?.forEach(transaction => {
        const date = new Date(transaction.transaction_date);
        const monthIndex = date.getMonth();
        const amount = parseFloat(transaction.amount.toString());
        
        monthlyData[monthIndex].value += amount;
        monthlyData[monthIndex].count += 1;
      });

      // Format the data with labels
      return monthlyData.map(item => ({
        ...item,
        label: item.value > 0 ? `Rp${(item.value / 1000000).toFixed(1)}M` : 'Rp0'
      }));
    },
    enabled: !!organizationId,
    placeholderData: keepPreviousData,
  });
};
