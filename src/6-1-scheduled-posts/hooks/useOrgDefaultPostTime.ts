import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { formatDefaultTimeFromDb } from '../lib/resolveScheduledAtUtc';

const ORG_SCHEDULING_SETTINGS_KEY = 'orgSocialMediaSchedulingSettings';

export function useOrgDefaultPostTime() {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: [ORG_SCHEDULING_SETTINGS_KEY, organizationId],
    queryFn: async () => {
      if (!organizationId) return '18:00';
      const { data, error } = await supabase
        .from('organization_social_media_scheduling_settings')
        .select('default_post_time_wib')
        .eq('organization_id', organizationId)
        .maybeSingle();
      if (error) throw error;
      return formatDefaultTimeFromDb(data?.default_post_time_wib as string | null);
    },
    enabled: Boolean(organizationId),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useOrgSchedulingSettings() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const defaultTimeQuery = useOrgDefaultPostTime();

  const updateDefaultTime = useMutation({
    mutationFn: async (timeHhMm: string) => {
      if (!organizationId) throw new Error('No organization');
      const normalized = timeHhMm.trim().slice(0, 5);
      if (!/^\d{2}:\d{2}$/.test(normalized)) throw new Error('Invalid time');
      const { error } = await supabase
        .from('organization_social_media_scheduling_settings')
        .upsert({
          organization_id: organizationId,
          default_post_time_wib: `${normalized}:00`,
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
      return normalized;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ORG_SCHEDULING_SETTINGS_KEY, organizationId] });
    },
  });

  return {
    defaultPostTimeWib: defaultTimeQuery.data ?? '18:00',
    isLoading: defaultTimeQuery.isLoading,
    updateDefaultTime,
  };
}
