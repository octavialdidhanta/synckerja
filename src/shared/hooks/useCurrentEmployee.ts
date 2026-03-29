
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentUser } from './useCurrentUser';
import { useCurrentOrg } from './useCurrentOrg';

export const useCurrentEmployee = () => {
  const { user } = useCurrentUser();
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ['current-employee', user?.id, organizationId],
    queryFn: async () => {
      if (!user?.id || !organizationId) {
        return null;
      }

      const { data, error } = await supabase
        .from('employees')
        .select(`
          *,
          departments(id, name),
          job_positions(id, name),
          job_levels(id, name)
        `)
        .eq('user_id', user.id)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('useCurrentEmployee: Error fetching employee:', error);
        return null;
      }

      return data;
    },
    enabled: !!user?.id && !!organizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
};
