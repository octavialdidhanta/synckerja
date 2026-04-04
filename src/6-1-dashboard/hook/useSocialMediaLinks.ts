
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { toast } from 'sonner';
import { SocialMediaLink, CreateSocialMediaLinkData, UpdateSocialMediaLinkData } from '@/shared/types/social-media-links';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';

const SOCIAL_MEDIA_LINKS_QUERY_KEY = 'socialMediaLinks';

export const useSocialMediaLinks = (planId?: string) => {
  const queryClient = useQueryClient();
  const { data: currentEmployee } = useCurrentEmployee();

  // Fetch social media links for a specific plan
  const { data: links = [], isLoading, error } = useQuery({
    queryKey: [SOCIAL_MEDIA_LINKS_QUERY_KEY, planId],
    queryFn: async () => {
      if (!planId) return [];
      
      const { data, error } = await supabase
        .from('social_media_links')
        .select('*')
        .eq('social_media_plan_id', planId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as SocialMediaLink[];
    },
    enabled: !!planId,
    staleTime: 30 * 1000, // 30 seconds - data is fresh for 30s
    gcTime: 5 * 60 * 1000, // 5 minutes cache time
    refetchOnWindowFocus: false, // Disabled to prevent reload when switching windows
    refetchOnMount: false, // Don't refetch on mount if data is fresh (reduces unnecessary requests)
    retry: 1,
  });

  // Helper function to calculate on-time status
  const calculateOnTimeStatus = (actualPostDate: string | null, postDate: string) => {
    if (!actualPostDate || !postDate) return '';
    const actual = new Date(actualPostDate);
    const planned = new Date(postDate);
    if (actual <= planned) {
      return 'Ontime';
    } else {
      const diffTime = Math.abs(actual.getTime() - planned.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return `Late ${diffDays} Day${diffDays > 1 ? 's' : ''}`;
    }
  };

  // Helper function to update actual post date and on-time status
  const updateActualPostDate = async (socialMediaPlanId: string) => {
    const currentDate = new Date().toISOString().split('T')[0];
    
    // Get the plan's post_date to calculate on-time status
    const { data: planData, error: planError } = await supabase
      .from('social_media_plans')
      .select('post_date')
      .eq('id', socialMediaPlanId)
      .single();

    if (planError) {
      console.error('Failed to get plan data:', planError);
      return;
    }

    const onTimeStatus = calculateOnTimeStatus(currentDate, planData.post_date);

    const { error } = await supabase
      .from('social_media_plans')
      .update({ 
        actual_post_date: currentDate,
        on_time_status: onTimeStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', socialMediaPlanId);

    if (error) {
      console.error('Failed to update actual post date:', error);
    }
  };

  // Helper function to clear actual post date and on-time status
  const clearActualPostDate = async (socialMediaPlanId: string) => {
    const { error } = await supabase
      .from('social_media_plans')
      .update({ 
        actual_post_date: null,
        on_time_status: '',
        updated_at: new Date().toISOString()
      })
      .eq('id', socialMediaPlanId);

    if (error) {
      console.error('Failed to clear actual post date:', error);
    }
  };

  // Create new social media link
  const createLinkMutation = useMutation({
    mutationFn: async (linkData: CreateSocialMediaLinkData) => {
      const { data, error } = await supabase
        .from('social_media_links')
        .insert([linkData])
        .select()
        .single();

      if (error) throw error;
      return data as SocialMediaLink;
    },
    onSuccess: async (newLink) => {
      queryClient.setQueryData(
        [SOCIAL_MEDIA_LINKS_QUERY_KEY, newLink.social_media_plan_id],
        (old: SocialMediaLink[] = []) => [...old, newLink]
      );
      
      // Check from database if this is the first link (more reliable than cache)
      // We need to check BEFORE we update the cache, so we query the database
      const { data: existingLinks, error: checkError } = await supabase
        .from('social_media_links')
        .select('id, created_at')
        .eq('social_media_plan_id', newLink.social_media_plan_id)
        .order('created_at', { ascending: true });
      
      // Check if this is the first link (oldest created_at)
      const isFirstLink = !checkError && existingLinks && existingLinks.length > 0 
        ? existingLinks[0].id === newLink.id // The link we just created is the oldest
        : false;
      
      // Also check if post_link_created_by is already set
      const { data: planData } = await supabase
        .from('social_media_plans')
        .select('post_link_created_by')
        .eq('id', newLink.social_media_plan_id)
        .single();
      
      const needsUpdate = isFirstLink && !planData?.post_link_created_by && currentEmployee?.id;
      
      // Update actual post date when first link is created
      await updateActualPostDate(newLink.social_media_plan_id);
      
      // If this is the first link and post_link_created_by is not set, set it
      if (needsUpdate) {
        const { error: updateError } = await supabase
          .from('social_media_plans')
          .update({ 
            post_link_created_by: currentEmployee.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', newLink.social_media_plan_id);
        
        if (updateError) {
          console.error('Failed to update post_link_created_by:', updateError);
        } else {
          console.log('✅ post_link_created_by set to:', currentEmployee.id, 'for plan:', newLink.social_media_plan_id);
        }
      } else if (isFirstLink && !currentEmployee?.id) {
        console.warn('⚠️ Cannot set post_link_created_by: currentEmployee not available for plan:', newLink.social_media_plan_id);
      } else if (isFirstLink && planData?.post_link_created_by) {
        console.log('ℹ️ post_link_created_by already set for plan:', newLink.social_media_plan_id);
      }
      
      // Invalidate content plans to refresh the table
      queryClient.invalidateQueries({ queryKey: ['content-plans'] });
      queryClient.invalidateQueries({ queryKey: ['social-media-plans'] });
      // Invalidate all-social-media-links query to refresh ContentPostTab immediately
      queryClient.invalidateQueries({ 
        queryKey: ['all-social-media-links'],
        refetchType: 'active' // Force refetch for active queries
      });
      
      toast.success('Social media link added successfully');
    },
    onError: (error) => {
      console.error('Failed to create social media link:', error);
      toast.error('Failed to add social media link');
    },
  });

  // Update social media link
  const updateLinkMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: UpdateSocialMediaLinkData }) => {
      const { data, error } = await supabase
        .from('social_media_links')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as SocialMediaLink;
    },
    onSuccess: (updatedLink) => {
      queryClient.setQueryData(
        [SOCIAL_MEDIA_LINKS_QUERY_KEY, updatedLink.social_media_plan_id],
        (old: SocialMediaLink[] = []) =>
          old.map(link => link.id === updatedLink.id ? updatedLink : link)
      );
      // Invalidate all-social-media-links query to refresh ContentPostTab immediately
      queryClient.invalidateQueries({ 
        queryKey: ['all-social-media-links'],
        refetchType: 'active' // Force refetch for active queries
      });
      toast.success('Social media link updated successfully');
    },
    onError: (error) => {
      console.error('Failed to update social media link:', error);
      toast.error('Failed to update social media link');
    },
  });

  // Delete social media link
  const deleteLinkMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('social_media_links')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: async (deletedId, variables) => {
      if (planId) {
        queryClient.setQueryData(
          [SOCIAL_MEDIA_LINKS_QUERY_KEY, planId],
          (old: SocialMediaLink[] = []) =>
            old.filter(link => link.id !== deletedId)
        );
        
        // Check if this was the last link, if so, clear actual post date and on-time status
        const remainingLinks = queryClient.getQueryData([SOCIAL_MEDIA_LINKS_QUERY_KEY, planId]) as SocialMediaLink[] || [];
        if (remainingLinks.length === 0) {
          await clearActualPostDate(planId);
          
          // Clear post_link_created_by when all links are deleted
          const { error: updateError } = await supabase
            .from('social_media_plans')
            .update({ 
              post_link_created_by: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', planId);
          
          if (updateError) {
            console.error('Failed to clear post_link_created_by:', updateError);
          }
        }
        
        // Invalidate content plans to refresh the table
        queryClient.invalidateQueries({ queryKey: ['content-plans'] });
        queryClient.invalidateQueries({ queryKey: ['social-media-plans'] });
      }
      // Invalidate all-social-media-links query to refresh ContentPostTab immediately
      queryClient.invalidateQueries({ 
        queryKey: ['all-social-media-links'],
        refetchType: 'active' // Force refetch for active queries
      });
      toast.success('Social media link deleted successfully');
    },
    onError: (error) => {
      console.error('Failed to delete social media link:', error);
      toast.error('Failed to delete social media link');
    },
  });

  // Batch create multiple links
  const createMultipleLinksMutation = useMutation({
    mutationFn: async (linksData: CreateSocialMediaLinkData[]) => {
      // Validate and sanitize data before sending to prevent JSON errors
      const sanitizedLinks = linksData.map(link => {
        // Ensure all fields are strings and not null/undefined
        // Remove any potential problematic characters that could cause JSON parsing issues
        const sanitizeString = (str: any, isUrl: boolean = false): string => {
          if (str === null || str === undefined) return '';
          let cleaned = String(str).trim();
          // Remove null bytes which can break JSON
          cleaned = cleaned.replace(/\0/g, '');
          
          if (isUrl) {
            // For URLs, be more lenient - only remove truly problematic control characters
            // Keep most characters including query parameters, fragments, etc.
            cleaned = cleaned.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
          } else {
            // For other fields, remove control characters but keep printable characters
            cleaned = cleaned.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
          }
          
          return cleaned;
        };
        
        const sanitized: CreateSocialMediaLinkData = {
          social_media_plan_id: sanitizeString(link.social_media_plan_id, false),
          platform: sanitizeString(link.platform, false),
          social_media_name: sanitizeString(link.social_media_name, false),
          url: sanitizeString(link.url, true) // URL needs more lenient sanitization
        };
        
        // Validate required fields
        if (!sanitized.social_media_plan_id || !sanitized.platform || !sanitized.social_media_name || !sanitized.url) {
          console.error('Invalid link data:', {
            original: link,
            sanitized: sanitized,
            hasPlanId: !!sanitized.social_media_plan_id,
            hasPlatform: !!sanitized.platform,
            hasName: !!sanitized.social_media_name,
            hasUrl: !!sanitized.url
          });
          throw new Error(`Invalid link data: missing required fields`);
        }
        
        // Additional validation: ensure UUID format for social_media_plan_id
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(sanitized.social_media_plan_id)) {
          console.error('Invalid UUID format:', sanitized.social_media_plan_id);
          throw new Error(`Invalid social_media_plan_id format: ${sanitized.social_media_plan_id}`);
        }
        
        // Ensure URL is valid format
        if (!sanitized.url.startsWith('http://') && !sanitized.url.startsWith('https://')) {
          console.error('Invalid URL format:', sanitized.url);
          throw new Error(`Invalid URL format: must start with http:// or https://`);
        }
        
        return sanitized;
      }).filter(link => 
        link.social_media_plan_id && 
        link.platform && 
        link.social_media_name && 
        link.url
      );
      
      if (sanitizedLinks.length === 0) {
        throw new Error('No valid links to create');
      }
      
      // Log sanitized data for debugging (remove sensitive data if needed)
      console.log('Attempting to insert social media links:', sanitizedLinks.map(l => ({
        social_media_plan_id: l.social_media_plan_id,
        platform: l.platform,
        social_media_name: l.social_media_name?.substring(0, 50),
        url: l.url?.substring(0, 50)
      })));
      
      // Insert one by one to avoid JSON errors in batch insert
      // This is more reliable and helps identify which specific link causes issues
      const results: SocialMediaLink[] = [];
      
      for (const link of sanitizedLinks) {
        try {
          // Ensure data is properly formatted as plain objects (not class instances)
          // Create a fresh object to avoid any prototype pollution or hidden properties
          // Don't use JSON.parse/stringify as it might cause issues with special characters
          const insertData: CreateSocialMediaLinkData = {
            social_media_plan_id: String(link.social_media_plan_id).trim(),
            platform: String(link.platform).trim(),
            social_media_name: String(link.social_media_name).trim(),
            url: String(link.url).trim()
          };
          
          // Final validation before insert
          if (!insertData.social_media_plan_id || !insertData.platform || !insertData.social_media_name || !insertData.url) {
            console.error('Invalid link data - missing fields:', {
              hasPlanId: !!insertData.social_media_plan_id,
              hasPlatform: !!insertData.platform,
              hasName: !!insertData.social_media_name,
              hasUrl: !!insertData.url,
              originalLink: link
            });
            throw new Error(`Invalid link data: missing required fields`);
          }
          
          // Ensure all values are non-empty strings
          if (insertData.social_media_plan_id.length === 0 || 
              insertData.platform.length === 0 || 
              insertData.social_media_name.length === 0 || 
              insertData.url.length === 0) {
            console.error('Invalid link data - empty strings:', insertData);
            throw new Error(`Invalid link data: empty string values`);
          }
          
          const { data: singleData, error: singleError } = await supabase
            .from('social_media_links')
            .insert(insertData)
            .select()
            .single();
          
          if (singleError) {
            console.error('Failed to insert link:', {
              platform: insertData.platform,
              social_media_name: insertData.social_media_name,
              url: insertData.url,
              social_media_plan_id: insertData.social_media_plan_id,
              error: singleError,
              errorCode: singleError.code,
              errorMessage: singleError.message,
              errorDetails: singleError.details,
              errorHint: singleError.hint,
              fullInsertData: JSON.stringify(insertData)
            });
            throw singleError;
          }
          
          if (singleData) {
            results.push(singleData as SocialMediaLink);
          }
        } catch (singleError: any) {
          // If single insert fails, log detailed error and throw
          console.error('Single insert failed:', {
            link: {
              platform: link.platform,
              social_media_name: link.social_media_name?.substring(0, 50),
              url: link.url?.substring(0, 50)
            },
            error: singleError
          });
          throw singleError;
        }
      }
      
      return results;
    },
    onSuccess: async (newLinks) => {
      if (newLinks.length > 0 && planId) {
        const planIdForCheck = newLinks[0].social_media_plan_id;
        
        queryClient.setQueryData(
          [SOCIAL_MEDIA_LINKS_QUERY_KEY, planId],
          (old: SocialMediaLink[] = []) => [...old, ...newLinks]
        );
        
        // Check from database if these are the first links (more reliable than cache)
        const { data: existingLinks, error: checkError } = await supabase
          .from('social_media_links')
          .select('id, created_at')
          .eq('social_media_plan_id', planIdForCheck)
          .order('created_at', { ascending: true });
        
        // Check if the new links are the first ones (oldest created_at)
        const newLinkIds = new Set(newLinks.map(l => l.id));
        const isFirstLinks = !checkError && existingLinks && existingLinks.length > 0
          ? existingLinks.slice(0, newLinks.length).every(link => newLinkIds.has(link.id)) // All oldest links are the ones we just created
          : false;
        
        // Also check if post_link_created_by is already set
        const { data: planData } = await supabase
          .from('social_media_plans')
          .select('post_link_created_by')
          .eq('id', planIdForCheck)
          .single();
        
        const needsUpdate = isFirstLinks && !planData?.post_link_created_by && currentEmployee?.id;
        
        // Update actual post date when links are created
        await updateActualPostDate(planIdForCheck);
        
        // If these are the first links and post_link_created_by is not set, set it
        if (needsUpdate) {
          const { error: updateError } = await supabase
            .from('social_media_plans')
            .update({ 
              post_link_created_by: currentEmployee.id,
              updated_at: new Date().toISOString()
            })
            .eq('id', planIdForCheck);
          
          if (updateError) {
            console.error('Failed to update post_link_created_by:', updateError);
          } else {
            console.log('✅ post_link_created_by set to:', currentEmployee.id, 'for plan:', planIdForCheck);
          }
        } else if (isFirstLinks && !currentEmployee?.id) {
          console.warn('⚠️ Cannot set post_link_created_by: currentEmployee not available for plan:', planIdForCheck);
        } else if (isFirstLinks && planData?.post_link_created_by) {
          console.log('ℹ️ post_link_created_by already set for plan:', planIdForCheck);
        }
        
        // Invalidate content plans to refresh the table
        queryClient.invalidateQueries({ queryKey: ['content-plans'] });
        queryClient.invalidateQueries({ queryKey: ['social-media-plans'] });
      }
      // Invalidate all-social-media-links query to refresh ContentPostTab immediately
      queryClient.invalidateQueries({ 
        queryKey: ['all-social-media-links'],
        refetchType: 'active' // Force refetch for active queries
      });
      toast.success(`${newLinks.length} social media links added successfully`);
    },
    onError: (error) => {
      console.error('Failed to create multiple social media links:', error);
      toast.error('Failed to add social media links');
    },
  });

  return {
    // Data
    links,
    isLoading,
    error,

    // Actions
    createLink: createLinkMutation.mutate,
    updateLink: updateLinkMutation.mutate,
    deleteLink: deleteLinkMutation.mutate,
    createMultipleLinks: createMultipleLinksMutation.mutate,

    // Loading states
    isCreating: createLinkMutation.isPending,
    isUpdating: updateLinkMutation.isPending,
    isDeleting: deleteLinkMutation.isPending,
    isCreatingMultiple: createMultipleLinksMutation.isPending,
  };
};

