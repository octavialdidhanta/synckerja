import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Queue Google Ads deferred upload (requires gclid + payment_at via RPC). */
export async function enqueueGoogleAdsConversionPendingServer(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    leadId: string;
    salesActivityId?: string | null;
    paymentAt?: string;
    forceRetry?: boolean;
  },
): Promise<void> {
  const { organizationId, leadId, salesActivityId, paymentAt, forceRetry } = args;
  if (!organizationId || !leadId) return;

  const { error } = await admin.rpc("enqueue_google_ads_conversion_pending", {
    p_organization_id: organizationId,
    p_lead_id: leadId,
    p_sales_activity_id: salesActivityId ?? null,
    p_payment_at: paymentAt ?? new Date().toISOString(),
    p_force_retry: forceRetry ?? false,
  });
  if (error) {
    console.warn("enqueueGoogleAdsConversionPendingServer:", error.message);
  }
}

/** Meta offline conversion — still immediate upload. */
export function kickMetaAdsConversionServer(args: {
  supabaseUrl: string;
  serviceRoleKey: string;
  organizationId: string;
  leadId: string;
  salesActivityId?: string | null;
}): void {
  const { supabaseUrl, serviceRoleKey, organizationId, leadId, salesActivityId } = args;
  if (!supabaseUrl || !serviceRoleKey || !organizationId || !leadId) return;

  const headers = {
    Authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
    "Content-Type": "application/json",
  };
  const body = JSON.stringify({
    lead_id: leadId,
    organization_id: organizationId,
    ...(salesActivityId ? { sales_activity_id: salesActivityId } : {}),
  });

  void fetch(`${supabaseUrl}/functions/v1/meta-ads-upload-conversion`, {
    method: "POST",
    headers,
    body,
  }).catch((e) => console.warn("kickMetaAdsConversionServer:", e));
}

/** Google enqueue (deferred) + Meta immediate kick. */
export async function kickOfflineConversionsServer(args: {
  admin: SupabaseClient;
  supabaseUrl: string;
  serviceRoleKey: string;
  organizationId: string;
  leadId: string;
  salesActivityId?: string | null;
  paymentAt?: string;
}): Promise<void> {
  const { admin, supabaseUrl, serviceRoleKey, organizationId, leadId, salesActivityId, paymentAt } =
    args;

  await enqueueGoogleAdsConversionPendingServer(admin, {
    organizationId,
    leadId,
    salesActivityId,
    paymentAt,
  });

  kickMetaAdsConversionServer({
    supabaseUrl,
    serviceRoleKey,
    organizationId,
    leadId,
    salesActivityId,
  });
}
