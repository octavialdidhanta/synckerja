
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { toast } from 'sonner';
import { SocialMediaName, CreateSocialMediaNameData, UpdateSocialMediaNameData } from '@/shared/types/social-media-names';

const SOCIAL_MEDIA_NAMES_QUERY_KEY = 'socialMediaNames';

export const useSocialMediaNames = (organizationId?: string, options?: { enabled?: boolean }) => {
  const queryClient = useQueryClient();
  const queryEnabled = !!organizationId && (options?.enabled ?? true);

  // Fetch social media names for organization
  const { data: socialMediaNames = [], isLoading, error } = useQuery({
    queryKey: [SOCIAL_MEDIA_NAMES_QUERY_KEY, organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('social_media_names')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('platform', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      return data as SocialMediaName[];
    },
    enabled: queryEnabled,
    staleTime: 5 * 60 * 1000, // 5 minutes - social media names don't change often
    gcTime: 10 * 60 * 1000, // 10 minutes cache time
    refetchOnWindowFocus: false, // Disabled to prevent reload when switching windows
    refetchOnMount: false, // Don't refetch on mount if data is fresh
  });

  // Get names by platform (case-insensitive comparison)
  const getNamesByPlatform = (platform: string) => {
    if (!platform || platform.trim() === '') return [];
    const filtered = socialMediaNames.filter(name => 
      name.platform && 
      name.platform.trim().toLowerCase() === platform.trim().toLowerCase()
    );
    
    // Debug logging (can be removed in production)
    if (process.env.NODE_ENV === 'development' && filtered.length === 0 && socialMediaNames.length > 0) {
      console.log('🔍 getNamesByPlatform debug:', {
        platform,
        totalNames: socialMediaNames.length,
        availablePlatforms: [...new Set(socialMediaNames.map(n => n.platform))],
        allNames: socialMediaNames
      });
    }
    
    return filtered;
  };

  // Create new social media name
  const createNameMutation = useMutation({
    mutationFn: async (nameData: CreateSocialMediaNameData) => {
      const { data, error } = await supabase
        .from('social_media_names')
        .insert([nameData])
        .select()
        .single();

      if (error) throw error;
      return data as SocialMediaName;
    },
    onSuccess: (newName) => {
      queryClient.setQueryData(
        [SOCIAL_MEDIA_NAMES_QUERY_KEY, newName.organization_id],
        (old: SocialMediaName[] = []) => [...old, newName]
      );
      toast.success('Social media name added successfully');
    },
    onError: (error) => {
      console.error('Failed to create social media name:', error);
      toast.error('Failed to add social media name');
    },
  });

  // Update social media name
  const updateNameMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateSocialMediaNameData }) => {
      const { data, error } = await supabase
        .from('social_media_names')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as SocialMediaName;
    },
    onSuccess: (updatedName) => {
      queryClient.setQueryData(
        [SOCIAL_MEDIA_NAMES_QUERY_KEY, updatedName.organization_id],
        (old: SocialMediaName[] = []) =>
          old.map(name => name.id === updatedName.id ? updatedName : name)
      );
      toast.success('Social media name updated successfully');
    },
    onError: (error) => {
      console.error('Failed to update social media name:', error);
      toast.error('Failed to update social media name');
    },
  });

  // Delete social media name
  const deleteNameMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('social_media_names')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: (deletedId) => {
      if (organizationId) {
        queryClient.setQueryData(
          [SOCIAL_MEDIA_NAMES_QUERY_KEY, organizationId],
          (old: SocialMediaName[] = []) =>
            old.filter(name => name.id !== deletedId)
        );
      }
      toast.success('Social media name deleted successfully');
    },
    onError: (error) => {
      console.error('Failed to delete social media name:', error);
      toast.error('Failed to delete social media name');
    },
  });

  return {
    // Data
    socialMediaNames,
    isLoading,
    error,
    getNamesByPlatform,

    // Actions
    createName: createNameMutation.mutate,
    updateName: updateNameMutation.mutate,
    deleteName: deleteNameMutation.mutate,

    // Loading states
    isCreating: createNameMutation.isPending,
    isUpdating: updateNameMutation.isPending,
    isDeleting: deleteNameMutation.isPending,
  };
};





