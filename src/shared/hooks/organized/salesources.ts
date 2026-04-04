import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useToast } from '@/shared/components/ui/use-toast';

// Types
export interface LeadSource {
  id: string;
  name: string;
  description: string | null;
  organization_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface CreateLeadSourceData {
  name: string;
  description?: string;
}

export interface UpdateLeadSourceData {
  name?: string;
  description?: string;
  is_active?: boolean;
}

// Hook: useLeadSources
export const useLeadSources = () => {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch lead sources
  const { data: sources = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['lead-sources', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('lead_sources')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching lead sources:', error);
        throw error;
      }

      return data || [];
    },
    enabled: !!organizationId,
  });

  // Create lead source
  const createSourceMutation = useMutation({
    mutationFn: async (sourceData: CreateLeadSourceData) => {
      if (!organizationId) {
        throw new Error('Organization ID is required');
      }

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      const { data, error } = await supabase
        .from('lead_sources')
        .insert({
          name: sourceData.name,
          description: sourceData.description || null,
          organization_id: organizationId,
          is_active: true,
          created_by: userId || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating lead source:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-sources', organizationId] });
      toast({
        title: 'Success',
        description: 'Lead source created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create lead source',
        variant: 'destructive',
      });
    },
  });

  // Update lead source
  const updateSourceMutation = useMutation({
    mutationFn: async ({ id, data: sourceData }: { id: string; data: UpdateLeadSourceData }) => {
      const { data, error } = await supabase
        .from('lead_sources')
        .update({
          ...sourceData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating lead source:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-sources', organizationId] });
      toast({
        title: 'Success',
        description: 'Lead source updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update lead source',
        variant: 'destructive',
      });
    },
  });

  // Delete lead source (soft delete by setting is_active to false)
  const deleteSourceMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('lead_sources')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        console.error('Error deleting lead source:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-sources', organizationId] });
      toast({
        title: 'Success',
        description: 'Lead source deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete lead source',
        variant: 'destructive',
      });
    },
  });

  return {
    sources: sources as LeadSource[],
    loading,
    refetch,
    createSource: createSourceMutation.mutateAsync,
    updateSource: (id: string, data: UpdateLeadSourceData) => 
      updateSourceMutation.mutateAsync({ id, data }),
    deleteSource: deleteSourceMutation.mutateAsync,
  };
};









