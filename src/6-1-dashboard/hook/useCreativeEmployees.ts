import { useQuery } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { getDigitalMarketingEmployeesQueryOptions } from '../data/dashboardQueryOptions';

export interface CreativeEmployee {
  id: string;
  full_name: string;
  email: string;
  user_id?: string;
  job_position_name?: string;
  job_position_id?: string;
}

/** Same employee list as digital marketing — shared query key avoids duplicate fetch. */
export const useCreativeEmployees = () => {
  const { organizationId } = useCurrentOrg();
  return useQuery({
    ...getDigitalMarketingEmployeesQueryOptions(organizationId),
    enabled: !!organizationId,
  });
};
