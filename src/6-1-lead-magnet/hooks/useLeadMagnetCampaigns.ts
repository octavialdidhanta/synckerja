import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  detail: (id: string) => ['lead-magnet-campaign', id] as const,
  media: (platform: LeadMagnetPlatform, accountId: string) =>
    ['lead-magnet-media', platform, accountId] as const,
  analytics: (id: string) => ['lead-magnet-analytics', id] as const,
};

export function useLeadMagnetCampaigns(enabled = true) {
  return useQuery({
    queryKey: leadMagnetQueryKeys.all,
    enabled,
    queryFn: fetchLeadMagnetCampaigns,
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
  return useQuery({
    queryKey: leadMagnetQueryKeys.media(platform, accountId),
    enabled: Boolean(accountId),
    queryFn: () => fetchLeadMagnetMediaPosts(platform, accountId),
  });
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
