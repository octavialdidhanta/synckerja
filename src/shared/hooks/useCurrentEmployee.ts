
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from './useCurrentUser';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { CURRENT_EMPLOYEE_QUERY_KEY, fetchCurrentEmployee } from './currentEmployeeQuery';

export const useCurrentEmployee = () => {
  const { user } = useCurrentUser();
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: [CURRENT_EMPLOYEE_QUERY_KEY, user?.id, organizationId],
    queryFn: async () => {
      if (!user?.id || !organizationId) {
        return null;
      }
      return fetchCurrentEmployee(user.id, organizationId);
    },
    enabled: !!user?.id && !!organizationId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
};
