import { invalidateGoogleAdsConversionUploads } from '@/5-3-dashboard/hooks/useGoogleAdsConversionUploadsMap';
import { supabase } from '@/shared/lib/supabaseClient';
import { devLog } from '@/shared/lib/logger';

/**
 * Queue lead for deferred Google Ads upload after qualifying payment (DP/full).
 * Requires gclid on lead; cron uploads after 5h via google-ads-upload-pending-conversions.
 */
export function enqueueGoogleAdsConversionPending(args: {
  leadId: string;
  organizationId: string;
  salesActivityId?: string | null;
  paymentAt?: string;
  forceRetry?: boolean;
}): void {
  const leadId = String(args.leadId ?? '').trim();
  const organizationId = String(args.organizationId ?? '').trim();
  if (!leadId || !organizationId) return;
  if (leadId.startsWith('wa-') || leadId.startsWith('email-')) return;

  const salesActivityId =
    args.salesActivityId != null && String(args.salesActivityId).trim() !== ''
      ? String(args.salesActivityId).trim()
      : undefined;

  void (async () => {
    try {
      const { data, error } = await supabase.rpc('enqueue_google_ads_conversion_pending', {
        p_organization_id: organizationId,
        p_lead_id: leadId,
        p_sales_activity_id: salesActivityId ?? null,
        p_payment_at: args.paymentAt ?? new Date().toISOString(),
        p_force_retry: args.forceRetry ?? false,
      });
      if (error) {
        devLog.warn('[enqueueGoogleAdsConversionPending]', error.message);
        return;
      }
      if (data === true) {
        invalidateGoogleAdsConversionUploads(organizationId);
      }
    } catch (e) {
      devLog.warn('[enqueueGoogleAdsConversionPending]', e);
    }
  })();
}
