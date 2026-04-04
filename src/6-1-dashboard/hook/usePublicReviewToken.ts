import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { devLog } from '@/shared/lib/logger';

function generateToken(): string {
  const u = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return u.replace(/-/g, '').slice(0, 24) + Math.random().toString(36).slice(2, 10);
}

export interface PublicReviewTokenResult {
  token: string;
  publicReviewUrl: string;
}

export function usePublicReviewToken() {
  const queryClient = useQueryClient();

  const getOrCreateMutation = useMutation({
    mutationFn: async ({
      socialMediaPlanId,
      linkUrl,
    }: {
      socialMediaPlanId: string;
      linkUrl: string;
    }): Promise<PublicReviewTokenResult> => {
      const effectiveLinkUrl = linkUrl?.trim() || 'default-link';
      if (!socialMediaPlanId) {
        throw new Error('Social media plan ID is required');
      }

      const { data: existing } = await supabase
        .from('public_review_tokens')
        .select('token')
        .eq('social_media_plan_id', socialMediaPlanId)
        .eq('link_url', effectiveLinkUrl)
        .limit(1)
        .maybeSingle();

      if (existing?.token) {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        return {
          token: existing.token,
          publicReviewUrl: `${origin}/review/${existing.token}`,
        };
      }

      const token = generateToken();
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('public_review_tokens').insert({
        token,
        social_media_plan_id: socialMediaPlanId,
        link_url: effectiveLinkUrl,
        created_by: user?.id ?? null,
      });

      if (error) {
        devLog.debug('Failed to create public review token:', error);
        throw error;
      }

      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      return {
        token,
        publicReviewUrl: `${origin}/review/${token}`,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-review-token'] });
    },
  });

  return {
    getOrCreate: getOrCreateMutation.mutateAsync,
    isPending: getOrCreateMutation.isPending,
    error: getOrCreateMutation.error,
  };
}
