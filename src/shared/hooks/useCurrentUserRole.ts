
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';
import { CURRENT_USER_ROLE_QUERY_KEY } from '@/shared/auth/identityQuerySync';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';

/**
 * Role in the active organization. Prefer CentralizedUserDataContext (no extra network)
 * and fall back to RPC only when central hydration finished without a role.
 */
export const useCurrentUserRole = () => {
  const { userRole, centralProfileHydrated, loading: centralLoading } = useCentralizedUserData();

  const fallbackQuery = useQuery({
    queryKey: CURRENT_USER_ROLE_QUERY_KEY,
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: roleData, error: roleError } = await supabase.rpc(
        'get_user_role_in_active_org',
      );

      if (roleError) {
        console.error('Error fetching user role in active org:', roleError);
        return null;
      }

      return roleData;
    },
    enabled: centralProfileHydrated && !centralLoading && userRole == null,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  });

  const resolvedRole = userRole ?? fallbackQuery.data ?? null;

  return {
    ...fallbackQuery,
    data: resolvedRole,
    isLoading: !centralProfileHydrated || centralLoading || (userRole == null && fallbackQuery.isLoading),
    isPending: !centralProfileHydrated || centralLoading || (userRole == null && fallbackQuery.isPending),
  };
};
