import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';

export type CreateOkrCycleData = {
  organization_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active?: boolean;
  year: number;
  quarter?: 'q1' | 'q2' | 'q3' | 'q4' | null;
  period_type: 'yearly' | 'half_yearly' | 'quarterly';
  created_by: string;
};

export const useCreateOkrCycle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateOkrCycleData) => {
      const { data: cycle, error } = await supabase
        .from('okr_cycles')
        .insert([{
          organization_id: data.organization_id,
          name: data.name,
          start_date: data.start_date,
          end_date: data.end_date,
          is_active: data.is_active ?? false,
          year: data.year,
          quarter: data.quarter,
          period_type: data.period_type,
          created_by: data.created_by
        }])
        .select()
        .single();

      if (error) throw error;
      return cycle;
    },
    onSuccess: (_, variables) => {
      // Invalidate cycles query to refetch
      queryClient.invalidateQueries({ 
        queryKey: ['okr-cycles', variables.organization_id] 
      });
    },
  });
};

