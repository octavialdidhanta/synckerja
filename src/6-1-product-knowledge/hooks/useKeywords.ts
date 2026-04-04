import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useUserData } from '@/shared/auth/hooks/useUserData';

export interface Keyword {
  id: string;
  organization_id: string;
  service_id: string | null;
  keyword: string;
  service_name?: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateKeywordInput {
  service_id: string;
  keyword: string;
}

export interface UpdateKeywordInput {
  service_id?: string;
  keyword?: string;
}

export const useKeywords = () => {
  const { organizationId: orgIdFromHook } = useCurrentOrg();
  const { profile } = useUserData();
  
  // Fallback to profile.active_organization_id if useCurrentOrg doesn't return organizationId
  const organizationId = orgIdFromHook || profile?.active_organization_id || null;

  return useQuery({
    queryKey: ['keywords', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('keywords')
        .select(`
          *,
          services (
            name
          )
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching keywords:', error);
        throw error;
      }

      return (data || []).map((item: any) => ({
        ...item,
        service_name: item.services?.name || null,
      })) as Keyword[];
    },
    enabled: !!organizationId,
  });
};

export const useKeywordsMutations = () => {
  const { organizationId: orgIdFromHook } = useCurrentOrg();
  const { profile } = useUserData();
  const queryClient = useQueryClient();
  
  // Fallback to profile.active_organization_id if useCurrentOrg doesn't return organizationId
  const organizationId = orgIdFromHook || profile?.active_organization_id || null;

  const createMutation = useMutation({
    mutationFn: async (data: CreateKeywordInput) => {
      // Get organizationId with fallback
      let finalOrganizationId = organizationId;
      
      // If organizationId is still null, try to fetch it from profile
      if (!finalOrganizationId) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user?.id) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('active_organization_id')
            .eq('user_id', userData.user.id)
            .single();
          finalOrganizationId = profileData?.active_organization_id || null;
        }
      }

      if (!finalOrganizationId) {
        throw new Error('Organization ID is required. Please ensure you have an active organization.');
      }

      // Get the profile ID for created_by (keywords table references profiles.id, not profiles.user_id)
      let profileId = profile?.id || null;
      
      // If profile is not available, fetch it
      if (!profileId) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user?.id) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('id')
            .eq('user_id', userData.user.id)
            .single();
          profileId = profileData?.id || null;
        }
      }

      const { data: result, error } = await supabase
        .from('keywords')
        .insert({
          organization_id: finalOrganizationId,
          service_id: data.service_id,
          keyword: data.keyword.trim(),
          created_by: profileId,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating keyword:', error);
        throw error;
      }

      return result;
    },
    onSuccess: (_, variables) => {
      // Invalidate queries for the organizationId that was used
      const orgId = organizationId || profile?.active_organization_id;
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: ['keywords', orgId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['keywords'] });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateKeywordInput;
    }) => {
      const updateData: any = {};
      
      if (input.service_id !== undefined) {
        updateData.service_id = input.service_id;
      }
      
      if (input.keyword !== undefined) {
        updateData.keyword = input.keyword.trim();
      }

      // Get the profile ID for updated_by (keywords table references profiles.id, not profiles.user_id)
      let profileId = profile?.id || null;
      
      // If profile is not available, fetch it
      if (!profileId) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user?.id) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('id')
            .eq('user_id', userData.user.id)
            .single();
          profileId = profileData?.id || null;
        }
      }
      updateData.updated_by = profileId;

      const { data: result, error } = await supabase
        .from('keywords')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating keyword:', error);
        throw error;
      }

      return result;
    },
    onSuccess: () => {
      // Invalidate queries for the organizationId that was used
      const orgId = organizationId || profile?.active_organization_id;
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: ['keywords', orgId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['keywords'] });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('keywords').delete().eq('id', id);

      if (error) {
        console.error('Error deleting keyword:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keywords', organizationId] });
    },
  });

  const createMultipleMutation = useMutation({
    mutationFn: async (data: CreateKeywordInput[]) => {
      // Get organizationId with fallback
      let finalOrganizationId = organizationId;
      
      // If organizationId is still null, try to fetch it from profile
      if (!finalOrganizationId) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user?.id) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('active_organization_id')
            .eq('user_id', userData.user.id)
            .single();
          finalOrganizationId = profileData?.active_organization_id || null;
        }
      }

      if (!finalOrganizationId) {
        throw new Error('Organization ID is required. Please ensure you have an active organization.');
      }

      if (data.length === 0) {
        throw new Error('No keywords to create');
      }

      // Get the profile ID for created_by
      let profileId = profile?.id || null;
      
      // If profile is not available, fetch it
      if (!profileId) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user?.id) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('id')
            .eq('user_id', userData.user.id)
            .single();
          profileId = profileData?.id || null;
        }
      }

      // Prepare bulk insert data
      const insertData = data.map((item) => ({
        organization_id: finalOrganizationId,
        service_id: item.service_id,
        keyword: item.keyword.trim(),
        created_by: profileId,
      }));

      const { data: result, error } = await supabase
        .from('keywords')
        .insert(insertData)
        .select();

      if (error) {
        console.error('Error creating keywords:', error);
        throw error;
      }

      return result;
    },
    onSuccess: () => {
      // Invalidate queries for the organizationId that was used
      const orgId = organizationId || profile?.active_organization_id;
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: ['keywords', orgId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['keywords'] });
      }
    },
  });

  return {
    createKeyword: createMutation.mutateAsync,
    createMultipleKeywords: createMultipleMutation.mutateAsync,
    updateKeyword: updateMutation.mutateAsync,
    deleteKeyword: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isCreatingMultiple: createMultipleMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};

