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
  new_leads: 0,
  offline_visits: 0,
  new_followers: 0,
  new_emails: 0,
  new_phones: 0,
  transactions: 0,
  revenue: 0,
  aov: 0,
};

const EMPTY_CAMPAIGN_METRICS: LeadMagnetCampaignMetrics = {
  ...EMPTY_TOTALS,
  non_follower_at_start: 0,
  total_enrollments: 0,
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
    campaigns: (body.campaigns ?? []).map((campaign) => ({
      ...campaign,
      metrics: { ...EMPTY_CAMPAIGN_METRICS, ...(campaign.metrics ?? {}) },
    })),
    totals: { ...EMPTY_TOTALS, ...(body.totals ?? {}) },
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

async function edgeErrorMessage(error: unknown, data: unknown): Promise<string> {
  if (data && typeof data === 'object' && data !== null && 'error' in data) {
    const message = (data as { error?: unknown }).error;
    if (typeof message === 'string' && message.trim()) return message;
  }
  const response = (error as { context?: Response } | null)?.context;
  if (response && typeof response.clone === 'function') {
    try {
      const body = (await response.clone().json()) as { error?: unknown };
      if (typeof body?.error === 'string' && body.error.trim()) return body.error;
    } catch {
      /* non-JSON body */
    }
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Request failed';
}

export async function fetchLeadMagnetMediaPosts(
  platform: LeadMagnetPlatform,
  accountId: string,
  organizationId: string,
): Promise<LeadMagnetMediaPost[]> {
  const { data, error } = await supabase.functions.invoke('meta-content-comments', {
    body: {
      action: 'listPosts',
      organization_id: organizationId,
      platform,
      account_id: accountId,
    },
  });
  if (error || (data && typeof data === 'object' && data !== null && 'error' in data && (data as { error?: unknown }).error)) {
    throw new Error(await edgeErrorMessage(error, data));
  }
  const rows = (data as { posts?: Array<Record<string, unknown>> } | null)?.posts ?? [];
  return rows.flatMap((row) => {
    const mediaId = String(row.media_id ?? row.id ?? '').trim();
    if (!mediaId) return [];
    const mediaUrl = typeof row.media_url === 'string' ? row.media_url : null;
    const thumbnailUrl = typeof row.thumbnail_url === 'string' ? row.thumbnail_url : null;
    return [{
      media_id: mediaId,
      caption: typeof row.caption === 'string' ? row.caption : null,
      permalink: typeof row.permalink === 'string' ? row.permalink : null,
      timestamp: typeof row.timestamp === 'string' ? row.timestamp : null,
      media_type: typeof row.media_type === 'string' ? row.media_type : null,
      media_url: mediaUrl,
      thumbnail_url: thumbnailUrl ?? mediaUrl,
    }];
  });
}

export type LeadMagnetAccountChoiceOption = {
  account_id: string;
  label: string;
  eligible: boolean;
};

export type PrepareLeadMagnetFromPlanInput = {
  planId: string;
  name: string;
  offer: string;
  comment: string;
  trigger: string;
  pillarName: string;
  development: string;
  instagramAccountId?: string;
  facebookAccountId?: string;
};

export type PrepareLeadMagnetFromPlanResult = {
  ok: boolean;
  plan_id?: string;
  campaign_id?: string | null;
  file?: 'ready' | 'skipped' | 'failed' | 'none';
  code?: string | null;
  message?: string;
  instagram?: LeadMagnetAccountChoiceOption[];
  facebook?: LeadMagnetAccountChoiceOption[];
  instagram_account_id?: string | null;
  facebook_account_id?: string | null;
};

export async function prepareLeadMagnetFromPlan(
  input: PrepareLeadMagnetFromPlanInput,
): Promise<PrepareLeadMagnetFromPlanResult> {
  return authFetch('/prepareFromPlan', {
    method: 'POST',
    body: JSON.stringify({
      social_media_plan_id: input.planId,
      name: input.name,
      offer: input.offer,
      comment: input.comment,
      trigger: input.trigger,
      pillar_name: input.pillarName,
      development: input.development,
      instagram_account_id: input.instagramAccountId || undefined,
      facebook_account_id: input.facebookAccountId || undefined,
    }),
  }) as Promise<PrepareLeadMagnetFromPlanResult>;
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
