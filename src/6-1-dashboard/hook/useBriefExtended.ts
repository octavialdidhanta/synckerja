import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';

export interface BriefExtendedData {
  targetAudience: string | null;
  caption: string | null;
  linkReference: string | null;
}

const QUERY_KEY = 'brief-extended';

export function useBriefExtended(socialMediaPlanId: string | undefined, isOpen: boolean) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [QUERY_KEY, socialMediaPlanId],
    refetchOnWindowFocus: false, // Disabled to prevent reload when switching windows
    queryFn: async (): Promise<BriefExtendedData> => {
      if (!socialMediaPlanId) {
        return { targetAudience: null, caption: null, linkReference: null };
      }

      const [audienceResult, captionResult, linkRefResult] = await Promise.all([
        supabase
          .from('brief_target_audiences')
          .select('description')
          .eq('social_media_plan_id', socialMediaPlanId)
          .maybeSingle(),
        supabase
          .from('brief_captions')
          .select('content')
          .eq('social_media_plan_id', socialMediaPlanId)
          .maybeSingle(),
        supabase
          .from('brief_link_references')
          .select('content')
          .eq('social_media_plan_id', socialMediaPlanId)
          .maybeSingle(),
      ]);

      if (audienceResult.error) throw audienceResult.error;
      if (captionResult.error) throw captionResult.error;
      if (linkRefResult.error) throw linkRefResult.error;

      return {
        targetAudience: audienceResult.data?.description ?? null,
        caption: captionResult.data?.content ?? null,
        linkReference: linkRefResult.data?.content ?? null,
      };
    },
    enabled: !!socialMediaPlanId && isOpen,
    staleTime: 30 * 1000,
  });

  const invalidate = () => {
    if (socialMediaPlanId) {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, socialMediaPlanId] });
    }
  };

  return {
    targetAudience: query.data?.targetAudience ?? null,
    caption: query.data?.caption ?? null,
    linkReference: query.data?.linkReference ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    invalidate,
  };
}
