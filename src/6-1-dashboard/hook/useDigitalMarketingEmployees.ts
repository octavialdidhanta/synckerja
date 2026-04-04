import { useQuery } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { getDigitalMarketingEmployeesQueryOptions } from '../data/dashboardQueryOptions';

export interface DigitalMarketingEmployee {
  id: string;
  full_name: string;
  email: string;
  job_position_name?: string;
  job_position_id?: string;
  user_id?: string;
}

export const useDigitalMarketingEmployees = () => {
  const { organizationId } = useCurrentOrg();
  return useQuery({
    ...getDigitalMarketingEmployeesQueryOptions(organizationId),
    enabled: !!organizationId,
  });
};

