import { invalidateGoogleAdsConversionUploads } from '@/5-3-dashboard/hooks/useGoogleAdsConversionUploadsMap';
import { supabase } from '@/shared/lib/supabaseClient';
import { devLog } from '@/shared/lib/logger';

const DEFAULT_LIMIT = 50;

/**
 * Re-queue deferred Google Ads uploads for converted leads with gclid + payment.
 * Used after enabling "offline conversion uploads" in Google Ads settings.
 */
export async function retryGoogleAdsUploadsForConvertedLeads(
  organizationId: string,
  limit = DEFAULT_LIMIT,
): Promise<number> {
  const orgId = String(organizationId ?? '').trim();
  if (!orgId) return 0;

  const { data: successRows, error: successErr } = await supabase
    .from('google_ads_conversion_uploads')
    .select('lead_id')
    .eq('organization_id', orgId)
    .eq('status', 'success');

  if (successErr) {
    devLog.warn('[retryGoogleAdsUploadsForConvertedLeads]', successErr.message);
    return 0;
  }

  const successLeadIds = new Set((successRows ?? []).map((r) => String(r.lead_id)));

  const { data: leads, error: leadsErr } = await supabase
    .from('leads')
    .select('id, gclid, payment_at')
    .eq('organization_id', orgId)
    .not('converted_at', 'is', null)
    .not('gclid', 'is', null)
    .not('payment_at', 'is', null)
    .order('payment_at', { ascending: false })
    .limit(Math.max(limit, 100));

  if (leadsErr) {
    devLog.warn('[retryGoogleAdsUploadsForConvertedLeads]', leadsErr.message);
    return 0;
  }

  const toRetry = (leads ?? [])
    .filter((r) => {
      const id = String(r.id);
      const gclid = String((r as { gclid?: string | null }).gclid ?? '').trim();
      return id && gclid && !successLeadIds.has(id);
    })
    .slice(0, limit);

  let queued = 0;
  for (const row of toRetry) {
    const leadId = String(row.id);
    const { data, error } = await supabase.rpc('enqueue_google_ads_conversion_pending', {
      p_organization_id: orgId,
      p_lead_id: leadId,
      p_sales_activity_id: null,
      p_payment_at: (row as { payment_at?: string | null }).payment_at ?? new Date().toISOString(),
      p_force_retry: true,
    });
    if (error) {
      devLog.warn('[retryGoogleAdsUploadsForConvertedLeads]', leadId, error.message);
      continue;
    }
    if (data === true) queued += 1;
  }

  invalidateGoogleAdsConversionUploads(orgId);
  return queued;
}
