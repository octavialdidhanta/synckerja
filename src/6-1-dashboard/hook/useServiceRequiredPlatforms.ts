import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { toast } from 'sonner';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';

export interface ServiceRequiredPlatform {
  id: string;
  service_id: string;
  platform: string;
  social_media_name_id: string | null;
  custom_platform_name: string | null;
  is_active: boolean;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Joined data
  service?: {
    id: string;
    name: string;
  };
  social_media_name?: {
    id: string;
    name: string;
    platform: string;
  };
}

export interface CreateServiceRequiredPlatformData {
  service_id: string;
  platform: string;
  social_media_name_id?: string | null;
  custom_platform_name?: string | null;
  is_active?: boolean;
  organization_id: string;
}

export interface UpdateServiceRequiredPlatformData {
  platform?: string;
  social_media_name_id?: string | null;
  custom_platform_name?: string | null;
  is_active?: boolean;
}

const SERVICE_REQUIRED_PLATFORMS_QUERY_KEY = 'serviceRequiredPlatforms';

export const useServiceRequiredPlatforms = (serviceId?: string) => {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { isOwner, isAdmin } = useCentralizedUserData();

  // Check if user has permission to manage required platforms
  const canManage = isOwner || isAdmin;

  // Fetch required platforms for organization (optionally filtered by service)
  const { data: requiredPlatforms = [], isPending, isLoading, error } = useQuery({
    queryKey: [SERVICE_REQUIRED_PLATFORMS_QUERY_KEY, organizationId, serviceId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      let query = supabase
        .from('service_required_platforms')
        .select(`
          *,
          service:services(id, name),
          social_media_name:social_media_names(id, name, platform)
        `)
        .eq('organization_id', organizationId)
        .order('platform', { ascending: true });

      if (serviceId) {
        query = query.eq('service_id', serviceId);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      console.log('📋 useServiceRequiredPlatforms fetched:', {
        organizationId,
        serviceId,
        count: data?.length || 0,
        platforms: data?.map(rp => `${rp.platform} (active: ${rp.is_active})`) || []
      });
      
      return data as ServiceRequiredPlatform[];
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes - required platforms don't change often
    gcTime: 10 * 60 * 1000, // 10 minutes cache time
    refetchOnWindowFocus: false, // Disabled to prevent reload when switching windows
    refetchOnMount: false, // Don't refetch on mount if data is fresh (reduces unnecessary requests)
    retry: 1,
  });

  // Get required platforms by service
  const getRequiredPlatformsByService = (serviceId: string) => {
    return requiredPlatforms.filter(rp => 
      rp.service_id === serviceId && rp.is_active === true
    );
  };

  // Create new required platform
  const createRequiredPlatformMutation = useMutation({
    mutationFn: async (data: CreateServiceRequiredPlatformData) => {
      if (!canManage) {
        throw new Error('You do not have permission to manage required platforms');
      }

      // Check if a duplicate exists (including inactive ones)
      const { data: existingPlatforms, error: checkError } = await supabase
        .from('service_required_platforms')
        .select('id, is_active')
        .eq('service_id', data.service_id)
        .eq('platform', data.platform)
        .eq('social_media_name_id', data.social_media_name_id || null);

      if (checkError) {
        throw checkError;
      }

      // If duplicate exists and is inactive, reactivate it instead of creating new
      if (existingPlatforms && existingPlatforms.length > 0) {
        const existingPlatform = existingPlatforms[0];
        if (!existingPlatform.is_active) {
          // Reactivate the existing platform
          const { data: reactivatedPlatform, error: updateError } = await supabase
            .from('service_required_platforms')
            .update({
              is_active: true,
              custom_platform_name: data.custom_platform_name || null,
            })
            .eq('id', existingPlatform.id)
            .select(`
              *,
              service:services(id, name),
              social_media_name:social_media_names(id, name, platform)
            `)
            .single();

          if (updateError) throw updateError;
          return reactivatedPlatform as ServiceRequiredPlatform;
        } else {
          // Active duplicate exists - throw user-friendly error
          const platformName = data.custom_platform_name || 
            (data.social_media_name_id ? 'selected social media name' : 'this platform');
          throw new Error(`This platform (${data.platform}) with ${platformName} is already configured as a required platform for this service.`);
        }
      }

      // No duplicate exists, create new platform
      const { data: result, error } = await supabase
        .from('service_required_platforms')
        .insert([{
          service_id: data.service_id,
          platform: data.platform,
          social_media_name_id: data.social_media_name_id || null,
          custom_platform_name: data.custom_platform_name || null,
          is_active: data.is_active ?? true,
          organization_id: data.organization_id,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        }])
        .select(`
          *,
          service:services(id, name),
          social_media_name:social_media_names(id, name, platform)
        `)
        .single();

      if (error) {
        // Handle unique constraint violation with user-friendly message
        if (error.code === '23505' || error.message?.includes('unique constraint') || error.message?.includes('duplicate key')) {
          const platformName = data.custom_platform_name || 
            (data.social_media_name_id ? 'selected social media name' : 'this platform');
          throw new Error(`This platform (${data.platform}) with ${platformName} is already configured as a required platform for this service.`);
        }
        throw error;
      }
      return result as ServiceRequiredPlatform;
    },
    onSuccess: (newPlatform) => {
      queryClient.setQueryData(
        [SERVICE_REQUIRED_PLATFORMS_QUERY_KEY, organizationId, newPlatform.service_id],
        (old: ServiceRequiredPlatform[] = []) => [...old, newPlatform]
      );
      queryClient.invalidateQueries({ 
        queryKey: [SERVICE_REQUIRED_PLATFORMS_QUERY_KEY, organizationId] 
      });
      toast.success('Required platform added successfully');
    },
    onError: (error: any) => {
      console.error('Failed to create required platform:', error);
      const errorMessage = error.message || 'Failed to add required platform';
      toast.error(errorMessage);
    },
  });

  // Update required platform
  const updateRequiredPlatformMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateServiceRequiredPlatformData }) => {
      if (!canManage) {
        throw new Error('You do not have permission to manage required platforms');
      }

      // Get current platform data to check for duplicates
      const { data: currentPlatform, error: fetchError } = await supabase
        .from('service_required_platforms')
        .select('service_id, platform, social_media_name_id')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Check if update would create a duplicate
      const newPlatform = updates.platform || currentPlatform.platform;
      const newSocialMediaNameId = updates.social_media_name_id !== undefined 
        ? updates.social_media_name_id 
        : currentPlatform.social_media_name_id;

      const { data: duplicateCheck, error: checkError } = await supabase
        .from('service_required_platforms')
        .select('id')
        .eq('service_id', currentPlatform.service_id)
        .eq('platform', newPlatform)
        .eq('social_media_name_id', newSocialMediaNameId || null)
        .neq('id', id); // Exclude current platform

      if (checkError) throw checkError;

      if (duplicateCheck && duplicateCheck.length > 0) {
        const platformName = updates.custom_platform_name || 'selected social media name';
        throw new Error(`This platform (${newPlatform}) with ${platformName} is already configured as a required platform for this service.`);
      }

      const { data, error } = await supabase
        .from('service_required_platforms')
        .update(updates)
        .eq('id', id)
        .select(`
          *,
          service:services(id, name),
          social_media_name:social_media_names(id, name, platform)
        `)
        .single();

      if (error) {
        // Handle unique constraint violation with user-friendly message
        if (error.code === '23505' || error.message?.includes('unique constraint') || error.message?.includes('duplicate key')) {
          const platformName = updates.custom_platform_name || 'selected social media name';
          throw new Error(`This platform (${newPlatform}) with ${platformName} is already configured as a required platform for this service.`);
        }
        throw error;
      }
      return data as ServiceRequiredPlatform;
    },
    onSuccess: (updatedPlatform) => {
      queryClient.setQueryData(
        [SERVICE_REQUIRED_PLATFORMS_QUERY_KEY, organizationId, updatedPlatform.service_id],
        (old: ServiceRequiredPlatform[] = []) =>
          old.map(platform => platform.id === updatedPlatform.id ? updatedPlatform : platform)
      );
      queryClient.invalidateQueries({ 
        queryKey: [SERVICE_REQUIRED_PLATFORMS_QUERY_KEY, organizationId] 
      });
      toast.success('Required platform updated successfully');
    },
    onError: (error: any) => {
      console.error('Failed to update required platform:', error);
      toast.error(error.message || 'Failed to update required platform');
    },
  });

  // Toggle required platform status (active/inactive)
  const toggleRequiredPlatformStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      if (!canManage) {
        throw new Error('You do not have permission to manage required platforms');
      }

      const { data, error } = await supabase
        .from('service_required_platforms')
        .update({ is_active: isActive })
        .eq('id', id)
        .select(`
          *,
          service:services(id, name),
          social_media_name:social_media_names(id, name, platform)
        `)
        .single();

      if (error) throw error;
      return data as ServiceRequiredPlatform;
    },
    onSuccess: (updatedPlatform) => {
      queryClient.setQueryData(
        [SERVICE_REQUIRED_PLATFORMS_QUERY_KEY, organizationId, updatedPlatform.service_id],
        (old: ServiceRequiredPlatform[] = []) =>
          old.map(platform => 
            platform.id === updatedPlatform.id ? updatedPlatform : platform
          )
      );
      queryClient.invalidateQueries({ 
        queryKey: [SERVICE_REQUIRED_PLATFORMS_QUERY_KEY, organizationId] 
      });
      toast.success(`Required platform ${updatedPlatform.is_active ? 'activated' : 'deactivated'} successfully`);
    },
    onError: (error: any) => {
      console.error('Failed to toggle required platform status:', error);
      toast.error(error.message || 'Failed to update required platform status');
    },
  });

  // Delete required platform (soft delete by setting is_active = false)
  const deleteRequiredPlatformMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!canManage) {
        throw new Error('You do not have permission to manage required platforms');
      }

      const { error } = await supabase
        .from('service_required_platforms')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: (deletedId) => {
      if (organizationId) {
        queryClient.setQueryData(
          [SERVICE_REQUIRED_PLATFORMS_QUERY_KEY, organizationId],
          (old: ServiceRequiredPlatform[] = []) =>
            old.map(platform => 
              platform.id === deletedId 
                ? { ...platform, is_active: false } 
                : platform
            )
        );
        queryClient.invalidateQueries({ 
          queryKey: [SERVICE_REQUIRED_PLATFORMS_QUERY_KEY, organizationId] 
        });
      }
      toast.success('Required platform deleted successfully');
    },
    onError: (error: any) => {
      console.error('Failed to delete required platform:', error);
      toast.error(error.message || 'Failed to delete required platform');
    },
  });

  return {
    // Data
    requiredPlatforms,
    isPending,
    isLoading,
    error,
    getRequiredPlatformsByService,

    // Actions
    createRequiredPlatform: createRequiredPlatformMutation.mutate,
    createRequiredPlatformAsync: createRequiredPlatformMutation.mutateAsync,
    updateRequiredPlatform: updateRequiredPlatformMutation.mutate,
    toggleRequiredPlatformStatus: toggleRequiredPlatformStatusMutation.mutate,
    deleteRequiredPlatform: deleteRequiredPlatformMutation.mutate,

    // Loading states
    isCreating: createRequiredPlatformMutation.isPending,
    isUpdating: updateRequiredPlatformMutation.isPending,
    isToggling: toggleRequiredPlatformStatusMutation.isPending,
    isDeleting: deleteRequiredPlatformMutation.isPending,

    // Permissions
    canManage,
  };
};

