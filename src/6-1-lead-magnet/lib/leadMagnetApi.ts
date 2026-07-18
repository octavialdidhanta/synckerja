import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/shared/lib/supabaseClient';
import type {
  LeadMagnetCampaign,
  LeadMagnetCampaignForm,
  LeadMagnetCampaignMetricTotals,
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

export type LeadMagnetCampaignsListResult = {
  campaigns: LeadMagnetCampaign[];
  totals: LeadMagnetCampaignMetricTotals;
  date_start?: string;
  date_end?: string;
};

const EMPTY_TOTALS: LeadMagnetCampaignMetricTotals = {
  new_followers: 0,
  new_emails: 0,
  new_phones: 0,
};

export async function fetchLeadMagnetCampaigns(opts?: {
  dateStart?: string;
  dateEnd?: string;
}): Promise<LeadMagnetCampaignsListResult> {
  const params = new URLSearchParams();
  if (opts?.dateStart) params.set('date_start', opts.dateStart);
  if (opts?.dateEnd) params.set('date_end', opts.dateEnd);
  const qs = params.toString();
  const res = await authFetch(qs ? `?${qs}` : '');
  const body = res as {
    campaigns?: LeadMagnetCampaign[];
    totals?: LeadMagnetCampaignMetricTotals;
    date_start?: string;
    date_end?: string;
  };
  return {
    campaigns: body.campaigns ?? [],
    totals: body.totals ?? EMPTY_TOTALS,
    date_start: body.date_start,
    date_end: body.date_end,
  };
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
