import { useMemo } from 'react';
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { toCurrentUserEmployeeView } from '@/shared/hooks/currentEmployeeQuery';

/**
 * Eligible employee view for Home motivation / request forms.
 * Shares `useCurrentEmployee` cache — no duplicate `employees` / `profiles` fetch.
 */
export const useCurrentUserEmployee = () => {
  const { userData } = useCentralizedUserData();
  const query = useCurrentEmployee();

  const data = useMemo(() => {
    if (!query.data) return null;
    return toCurrentUserEmployeeView(query.data, userData?.full_name);
  }, [query.data, userData?.full_name]);

  return {
    ...query,
    data,
  };
};
