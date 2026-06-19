
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';
import { useToast } from '@/shared/components/ui/use-toast';

export const useCompanyProfile = () => {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ['company-profile', organizationId],
    queryFn: async () => {
      if (!organizationId) return null;

      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .single();

      if (error) {
        console.error('Error fetching company profile:', error);
        throw error;
      }

      return data;
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useUpdateCompany = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { refreshUserData } = useCentralizedUserData();

  return useMutation({
    mutationFn: async (updates: any) => {
      if (!organizationId) {
        throw new Error('Organization ID not found');
      }

      const companyName = String(updates.company_name ?? '').trim();
      if (!companyName) {
        throw new Error('Company name is required');
      }

      const { data, error } = await supabase
        .from('organizations')
        .update({ ...updates, company_name: companyName, updated_at: new Date().toISOString() })
        .eq('id', organizationId)
        .select()
        .single();

      if (error) {
        console.error('Error updating company:', error);
        throw error;
      }

      return data;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['company-profile'] });
      await refreshUserData();
      toast({
        title: 'Success',
        description: 'Company profile updated successfully',
      });
    },
    onError: (error: any) => {
      console.error('Failed to update company:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update company profile',
        variant: 'destructive',
      });
    },
  });
};
