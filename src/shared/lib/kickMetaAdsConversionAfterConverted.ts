import { invalidateMetaAdsConversionUploads } from '@/5-3-dashboard/hooks/useMetaAdsConversionUploadsMap';
import { supabase } from '@/shared/lib/supabaseClient';
import { devLog } from '@/shared/lib/logger';

/** After CRM lead becomes Converted, upload Conversions API event to Meta Ads. */
export function kickMetaAdsConversionAfterConverted(args: {
  leadId: string;
  organizationId: string;
  salesActivityId?: string | null;
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
      const { data, error } = await supabase.functions.invoke('meta-ads-upload-conversion', {
        body: {
          lead_id: leadId,
          organization_id: organizationId,
          ...(salesActivityId ? { sales_activity_id: salesActivityId } : {}),
        },
      });
      if (error) {
        devLog.warn('[kickMetaAdsConversionAfterConverted]', error.message);
        return;
      }
      const payload = data as { ok?: boolean; skipped?: boolean; duplicate?: boolean; error?: string } | null;
      if (payload?.ok === false && payload?.error) {
        devLog.warn('[kickMetaAdsConversionAfterConverted]', payload.error);
      }
      invalidateMetaAdsConversionUploads(organizationId);
    } catch (e) {
      devLog.warn('[kickMetaAdsConversionAfterConverted]', e);
    }
  })();
}
