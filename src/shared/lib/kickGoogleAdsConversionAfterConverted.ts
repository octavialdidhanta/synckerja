import { enqueueGoogleAdsConversionPending } from '@/shared/lib/enqueueGoogleAdsConversionPending';

/**
 * @deprecated Use enqueueGoogleAdsConversionPending — uploads are deferred via pg_cron (5h after payment).
 */
export function kickGoogleAdsConversionAfterConverted(args: {
  leadId: string;
  organizationId: string;
  salesActivityId?: string | null;
}): void {
  enqueueGoogleAdsConversionPending({
    leadId: args.leadId,
    organizationId: args.organizationId,
    salesActivityId: args.salesActivityId,
  });
}
