/** Picu upload offline conversion Google/Meta via service role (internal). */

export function kickOfflineConversionsServer(args: {
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

  void fetch(`${supabaseUrl}/functions/v1/google-ads-upload-offline-conversion`, {
    method: "POST",
    headers,
    body,
  }).catch((e) => console.warn("kickOfflineConversionsServer google:", e));

  void fetch(`${supabaseUrl}/functions/v1/meta-ads-upload-conversion`, {
    method: "POST",
    headers,
    body,
  }).catch((e) => console.warn("kickOfflineConversionsServer meta:", e));
}
