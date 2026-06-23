import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import type { ScheduledPost } from '../types/scheduled-post';

export { buildScheduleByPlanId } from '../lib/pickTikTokScheduleDisplay';

export function useOrgActiveSchedules(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: ['socialMediaScheduledPosts', 'org-active', organizationId],
    queryFn: async () => {
      if (!organizationId) return [] as ScheduledPost[];
      const { data, error } = await supabase
        .from('social_media_scheduled_posts')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('platform', 'TikTok')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ScheduledPost[];
    },
    enabled: Boolean(organizationId),
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}
