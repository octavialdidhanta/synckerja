
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';

interface IncomeType {
  id: string;
  name: string;
  organization_id?: string;
}

interface IncomeCategory {
  id: string;
  name: string;
  income_types_id?: string;
  organization_id?: string;
}

interface Service {
  id: string;
  name: string;
  organization_id?: string;
}

interface SubService {
  id: string;
  name: string;
  service_id: string;
  organization_id?: string;
}

export const useIncomeMasterData = () => {
  const { organizationId } = useCurrentOrg();

  const incomeTypesQuery = useQuery({
    queryKey: ['income-types', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('income_types')
        .select('*')
        .or(`organization_id.eq.${organizationId},organization_id.is.null`)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as IncomeType[];
    },
    enabled: !!organizationId,
  });

  const incomeCategoriesQuery = useQuery({
    queryKey: ['income-categories', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('income_categories')
        .select('*')
        .or(`organization_id.eq.${organizationId},organization_id.is.null`)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as IncomeCategory[];
    },
    enabled: !!organizationId,
  });

  const servicesQuery = useQuery({
    queryKey: ['services', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('services')
        .select('*')
        .or(`organization_id.eq.${organizationId},organization_id.is.null`)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as Service[];
    },
    enabled: !!organizationId,
  });

  const subServicesQuery = useQuery({
    queryKey: ['sub-services', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('sub_services')
        .select('*')
        .or(`organization_id.eq.${organizationId},organization_id.is.null`)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as SubService[];
    },
    enabled: !!organizationId,
  });

  const incomeTypes = incomeTypesQuery.data ?? [];
  const incomeCategories = incomeCategoriesQuery.data ?? [];
  const services = servicesQuery.data ?? [];
  const subServices = subServicesQuery.data ?? [];

  const isLoading =
    incomeTypesQuery.isLoading ||
    incomeCategoriesQuery.isLoading ||
    servicesQuery.isLoading ||
    subServicesQuery.isLoading;

  return {
    incomeTypes,
    incomeCategories,
    services,
    subServices,
    isLoading,
  };
};
