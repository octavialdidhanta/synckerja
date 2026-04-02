import { useState, useEffect } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';

export interface PayrollPeriod {
  id: string;
  organization_id: string;
  period_name: string;
  period_type: 'monthly' | 'weekly' | 'biweekly';
  start_date: string;
  end_date: string;
  pay_date: string;
  cut_off?: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  is_bonus_period: boolean;
}

export const usePayrollPeriods = (organizationId?: string) => {
  const [payrollPeriods, setPayrollPeriods] = useState<PayrollPeriod[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPayrollPeriods = async () => {
    if (!organizationId) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('payroll_periods')
        .select('*')
        .eq('organization_id', organizationId)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setPayrollPeriods(data as PayrollPeriod[]);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch payroll periods');
      setError(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchPayrollPeriods();
    }
  }, [organizationId]);

  return {
    payrollPeriods,
    isLoading,
    error,
    refetch: fetchPayrollPeriods,
  };
};
