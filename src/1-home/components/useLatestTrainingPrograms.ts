
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { logger } from '@/shared/lib/logger';

export interface LatestTrainingProgram {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  max_participants: number;
  participants_count: number;
  category: string;
  trainer_name?: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
}

export const useLatestTrainingPrograms = () => {
  const { organizationId } = useCurrentOrg();

  const { data: programs = [], isPending, isLoading, error } = useQuery({
    queryKey: ['latest-training-programs', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      logger.query('Fetching latest training programs for organization:', organizationId);

      const { data, error } = await supabase
        .from('training_programs')
        .select(`
          id,
          name,
          start_date,
          end_date,
          max_participants,
          category,
          trainer_name,
          status,
          training_participants!left(id, status)
        `)
        .eq('organization_id', organizationId)
        .eq('status', 'active')
        .gte('end_date', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) {
        console.error('Error fetching latest training programs:', error);
        throw error;
      }

      const programsWithCount = data.map(program => ({
        ...program,
        // Count only registered participants (approved participants)
        participants_count: program.training_participants?.filter(p => p.status === 'registered').length || 0
      }));

      logger.query('Latest training programs with correct count:', programsWithCount);
      return programsWithCount as LatestTrainingProgram[];
    },
    enabled: !!organizationId,
  });

  return {
    programs,
    isPending,
    isLoading: isPending || isLoading,
    error: error as Error | null | undefined,
  };
};

