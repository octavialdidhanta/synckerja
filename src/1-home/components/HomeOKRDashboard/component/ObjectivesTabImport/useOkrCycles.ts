import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';

export type OkrCycle = {
  id: string;
  organization_id: string;
  name: string;
  year: number;
  quarter?: string;
  period_type: 'yearly' | 'quarterly';
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
};

export const useOkrCycles = (organizationId?: string) => {
  return useQuery({
    queryKey: ['okr-cycles', organizationId],
    queryFn: async (): Promise<OkrCycle[]> => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('okr_cycles')
        .select('*')
        .eq('organization_id', organizationId)
        .order('start_date', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });
};
