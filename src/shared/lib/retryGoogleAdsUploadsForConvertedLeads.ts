import { invalidateGoogleAdsConversionUploads } from '@/5-3-dashboard/hooks/useGoogleAdsConversionUploadsMap';
import { kickGoogleAdsConversionAfterConverted } from '@/shared/lib/kickGoogleAdsConversionAfterConverted';
import { supabase } from '@/shared/lib/supabaseClient';
import { devLog } from '@/shared/lib/logger';

const DEFAULT_LIMIT = 50;

/**
 * Re-queue offline conversion uploads for converted leads that never succeeded.
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
    .select('id')
    .eq('organization_id', orgId)
    .not('converted_at', 'is', null)
    .order('converted_at', { ascending: false })
    .limit(Math.max(limit, 100));

  if (leadsErr) {
    devLog.warn('[retryGoogleAdsUploadsForConvertedLeads]', leadsErr.message);
    return 0;
  }

  const toRetry = (leads ?? [])
    .map((r) => String(r.id))
    .filter((id) => id && !successLeadIds.has(id))
    .slice(0, limit);

  for (const leadId of toRetry) {
    kickGoogleAdsConversionAfterConverted({ leadId, organizationId: orgId });
  }

  invalidateGoogleAdsConversionUploads(orgId);
  return toRetry.length;
}
