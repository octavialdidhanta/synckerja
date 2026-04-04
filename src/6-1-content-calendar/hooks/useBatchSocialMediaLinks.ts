import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useMemo } from 'react';
import { SocialMediaLink } from '@/shared/types/social-media-links';

const MAX_BATCH_SIZE = 50; // Prevent timeout with too many IDs

/**
 * Hook to batch fetch social media links for multiple plans
 * Optimized for calendar view where we need links for many plans at once
 * 
 * Features:
 * - Stable query key to prevent cache misses
 * - Batch size limit to prevent timeout
 * - Error handling that returns empty object instead of throwing
 * - Automatic grouping by plan_id
 */
export const useBatchSocialMediaLinks = (planIds: string[]) => {
  // Stabilize query key - prevent cache miss from array reference changes
  const stablePlanIds = useMemo(() => {
    if (!planIds || planIds.length === 0) return '';
    
    // Remove duplicates, filter empty strings, sort, and limit
    const uniqueIds = [...new Set(planIds)]
      .filter(Boolean) // Remove empty/null/undefined
      .sort()
      .slice(0, MAX_BATCH_SIZE); // Limit to prevent timeout
    
    return uniqueIds.join(',');
  }, [planIds.join(',')]); // Stable dependency - only changes when IDs actually change

  return useQuery({
    queryKey: ['batch-social-media-links', stablePlanIds],
    queryFn: async () => {
      if (!stablePlanIds) return {};
      
      const idsArray = stablePlanIds.split(',').filter(Boolean);
      if (idsArray.length === 0) return {};
      
      try {
        const { data, error } = await supabase
          .from('social_media_links')
          .select('id, social_media_plan_id, platform, url, social_media_name')
          .in('social_media_plan_id', idsArray)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error fetching batch social media links:', error);
          return {}; // Return empty object instead of throwing
        }
        
        // Group links by plan_id with null safety
        const linksByPlanId: Record<string, SocialMediaLink[]> = {};
        (data || []).forEach(link => {
          // Null safety checks
          if (link?.social_media_plan_id && link?.id && link?.platform && link?.url) {
            const planId = link.social_media_plan_id;
            if (!linksByPlanId[planId]) {
              linksByPlanId[planId] = [];
            }
            linksByPlanId[planId].push({
              id: link.id,
              social_media_plan_id: link.social_media_plan_id,
              platform: link.platform,
              url: link.url,
              social_media_name: link.social_media_name || null,
              created_at: link.created_at,
              updated_at: link.updated_at
            });
          }
        });
        
        return linksByPlanId;
      } catch (error) {
        console.error('Unexpected error in batch social media links query:', error);
        return {}; // Return empty on any error
      }
    },
    enabled: stablePlanIds.length > 0,
    staleTime: 30 * 1000, // 30 seconds - links don't change frequently
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    retry: 1, // Only retry once on failure
    refetchOnWindowFocus: false, // Don't refetch on focus
  });
};

