import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import {
  createLeadMagnetCampaign,
  deleteLeadMagnetCampaign,
  fetchLeadMagnetAnalytics,
  fetchLeadMagnetCampaign,
  fetchLeadMagnetCampaigns,
  fetchLeadMagnetMediaPosts,
  pauseLeadMagnetCampaign,
  publishLeadMagnetCampaign,
  updateLeadMagnetCampaign,
} from '../lib/leadMagnetApi';
import type { LeadMagnetCampaignForm, LeadMagnetPlatform } from '../types/leadMagnet.types';

export const leadMagnetQueryKeys = {
  all: ['lead-magnet-campaigns'] as const,
  list: (dateStart: string, dateEnd: string) =>
    ['lead-magnet-campaigns', dateStart, dateEnd] as const,
  detail: (id: string) => ['lead-magnet-campaign', id] as const,
  media: (platform: LeadMagnetPlatform, accountId: string) =>
    ['lead-magnet-media', platform, accountId] as const,
  analytics: (id: string) => ['lead-magnet-analytics', id] as const,
};

export function useLeadMagnetCampaigns(
  enabled = true,
  opts?: { dateStart?: string; dateEnd?: string },
) {
  const dateStart = opts?.dateStart ?? '';
  const dateEnd = opts?.dateEnd ?? '';
  return useQuery({
    queryKey: leadMagnetQueryKeys.list(dateStart, dateEnd),
    enabled: enabled && Boolean(dateStart && dateEnd),
    queryFn: () => fetchLeadMagnetCampaigns({ dateStart, dateEnd }),
  });
}

export function useLeadMagnetCampaign(id: string | undefined) {
  return useQuery({
    queryKey: leadMagnetQueryKeys.detail(id ?? ''),
    enabled: Boolean(id),
    queryFn: () => fetchLeadMagnetCampaign(id!),
  });
}

export function useLeadMagnetMediaPosts(platform: LeadMagnetPlatform, accountId: string) {
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const query = useQuery({
    queryKey: [...leadMagnetQueryKeys.media(platform, accountId), organizationId ?? ''],
    enabled: Boolean(accountId && organizationId),
    queryFn: () => fetchLeadMagnetMediaPosts(platform, accountId, organizationId!),
    retry: 1,
  });
  return {
    ...query,
    isLoading: query.isLoading || (Boolean(accountId) && orgLoading && !organizationId),
  };
}

export function useLeadMagnetAnalytics(campaignId: string | undefined) {
  return useQuery({
    queryKey: leadMagnetQueryKeys.analytics(campaignId ?? ''),
    enabled: Boolean(campaignId),
    queryFn: () => fetchLeadMagnetAnalytics(campaignId!),
  });
}

export function useCreateLeadMagnetCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: LeadMagnetCampaignForm) => createLeadMagnetCampaign(form),
    onSuccess: () => qc.invalidateQueries({ queryKey: leadMagnetQueryKeys.all }),
  });
}

export function useUpdateLeadMagnetCampaign(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: LeadMagnetCampaignForm) => updateLeadMagnetCampaign(id, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: leadMagnetQueryKeys.all });
      qc.invalidateQueries({ queryKey: leadMagnetQueryKeys.detail(id) });
    },
  });
}

export function usePublishLeadMagnetCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: publishLeadMagnetCampaign,
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: leadMagnetQueryKeys.all });
      qc.invalidateQueries({ queryKey: leadMagnetQueryKeys.detail(id) });
    },
  });
}

export function usePauseLeadMagnetCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pauseLeadMagnetCampaign,
    onSuccess: () => qc.invalidateQueries({ queryKey: leadMagnetQueryKeys.all }),
  });
}

export function useDeleteLeadMagnetCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteLeadMagnetCampaign,
    onSuccess: () => qc.invalidateQueries({ queryKey: leadMagnetQueryKeys.all }),
  });
}
