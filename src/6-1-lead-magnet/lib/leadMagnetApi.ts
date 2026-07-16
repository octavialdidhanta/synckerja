import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/shared/lib/supabaseClient';
import type {
  LeadMagnetCampaign,
  LeadMagnetCampaignForm,
  LeadMagnetCampaignMetrics,
  LeadMagnetEnrollment,
  LeadMagnetMediaPost,
  LeadMagnetPlatform,
} from '../types/leadMagnet.types';

async function authFetch(path: string, init?: RequestInit) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  const url = `${SUPABASE_URL}/functions/v1/lead-magnet-api${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof json.error === 'string' ? json.error : 'Request failed');
  }
  return json;
}

export async function fetchLeadMagnetCampaigns(): Promise<LeadMagnetCampaign[]> {
  const res = await authFetch('');
  return (res as { campaigns: LeadMagnetCampaign[] }).campaigns ?? [];
}

export async function fetchLeadMagnetCampaign(id: string): Promise<LeadMagnetCampaign> {
  const res = await authFetch(`/${encodeURIComponent(id)}`);
  return (res as { campaign: LeadMagnetCampaign }).campaign;
}

export async function createLeadMagnetCampaign(form: LeadMagnetCampaignForm): Promise<LeadMagnetCampaign> {
  const res = await authFetch('', { method: 'POST', body: JSON.stringify(form) });
  return (res as { campaign: LeadMagnetCampaign }).campaign;
}

export async function updateLeadMagnetCampaign(id: string, form: LeadMagnetCampaignForm): Promise<LeadMagnetCampaign> {
  const res = await authFetch(`/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(form) });
  return (res as { campaign: LeadMagnetCampaign }).campaign;
}

export async function publishLeadMagnetCampaign(id: string): Promise<LeadMagnetCampaign> {
  const res = await authFetch(`/${encodeURIComponent(id)}/publish`, { method: 'POST', body: '{}' });
  return (res as { campaign: LeadMagnetCampaign }).campaign;
}

export async function pauseLeadMagnetCampaign(id: string): Promise<void> {
  await authFetch(`/${encodeURIComponent(id)}/pause`, { method: 'POST', body: '{}' });
}

export async function deleteLeadMagnetCampaign(id: string): Promise<void> {
  await authFetch(`/${encodeURIComponent(id)}`, { method: 'DELETE', body: '{}' });
}

export async function fetchLeadMagnetMediaPosts(
  platform: LeadMagnetPlatform,
  accountId: string,
): Promise<LeadMagnetMediaPost[]> {
  const res = await authFetch('/listMedia', {
    method: 'POST',
    body: JSON.stringify({ platform, account_id: accountId }),
  });
  return (res as { posts: LeadMagnetMediaPost[] }).posts ?? [];
}

export async function fetchLeadMagnetAnalytics(id: string): Promise<{
  funnel: Record<string, number>;
  enrollments: LeadMagnetEnrollment[];
  metrics?: LeadMagnetCampaignMetrics;
}> {
  return authFetch(`/${encodeURIComponent(id)}/analytics`) as Promise<{
    funnel: Record<string, number>;
    enrollments: LeadMagnetEnrollment[];
    metrics?: LeadMagnetCampaignMetrics;
  }>;
}
