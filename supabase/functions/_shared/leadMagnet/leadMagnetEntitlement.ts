import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type LeadMagnetEntitlementResult = {
  entitled: boolean;
  reason?: "no_subscription" | "sales_module_disabled" | "addon_inactive" | "grace_expired";
};

/**
 * Resolves Lead Magnet access for an organization (mandiri add-on + grace, or sales CMS module).
 */
export async function resolveLeadMagnetEntitlement(
  admin: SupabaseClient,
  organizationId: string,
): Promise<LeadMagnetEntitlementResult> {
  const { data: orgRow } = await admin
    .from("organizations")
    .select("subscription_self_service_enabled")
    .eq("id", organizationId)
    .maybeSingle();

  const selfService = orgRow?.subscription_self_service_enabled !== false;

  if (!selfService) {
    const { data: modRow } = await admin
      .from("organization_sales_module_access")
      .select("is_enabled")
      .eq("organization_id", organizationId)
      .eq("module_key", "leadMagnet")
      .maybeSingle();

    if (modRow?.is_enabled === true) {
      return { entitled: true };
    }
    return { entitled: false, reason: "sales_module_disabled" };
  }

  const { data: subRow } = await admin
    .from("organization_subscriptions")
    .select("lead_magnet_active, lead_magnet_grace_until")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!subRow) {
    return { entitled: false, reason: "no_subscription" };
  }

  if (subRow.lead_magnet_active === true) {
    return { entitled: true };
  }

  const graceUntil = subRow.lead_magnet_grace_until as string | null;
  if (graceUntil && new Date(graceUntil).getTime() > Date.now()) {
    return { entitled: true };
  }

  return { entitled: false, reason: graceUntil ? "grace_expired" : "addon_inactive" };
}

export async function assertLeadMagnetEntitled(
  admin: SupabaseClient,
  organizationId: string,
): Promise<void> {
  const result = await resolveLeadMagnetEntitlement(admin, organizationId);
  if (!result.entitled) {
    const err = new Error("LEAD_MAGNET_NOT_ENTITLED");
    (err as Error & { code?: string; reason?: string }).code = "LEAD_MAGNET_NOT_ENTITLED";
    (err as Error & { reason?: string }).reason = result.reason;
    throw err;
  }
}
