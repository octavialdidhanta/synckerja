import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DEFAULT_MAX_PER_ORG_WINDOW } from "./rateLimitConfig.ts";

const orgMaxCache = new Map<string, number>();

export function clearOrgRateLimitCache(): void {
  orgMaxCache.clear();
}

async function resolveOrgMaxPerWindow(
  admin: SupabaseClient,
  organizationId: string,
): Promise<number> {
  const cached = orgMaxCache.get(organizationId);
  if (cached !== undefined) return cached;

  const { data, error } = await admin
    .from("organization_social_media_scheduling_settings")
    .select("max_publishes_per_5min")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const max = Math.min(
    20,
    Math.max(1, Number(data?.max_publishes_per_5min ?? DEFAULT_MAX_PER_ORG_WINDOW)),
  );
  orgMaxCache.set(organizationId, max);
  return max;
}

export async function acquirePublishSlot(
  admin: SupabaseClient,
  organizationId: string,
  platform: string,
): Promise<boolean> {
  const maxPerWindow = await resolveOrgMaxPerWindow(admin, organizationId);
  const { data, error } = await admin.rpc("try_acquire_social_media_publish_slot", {
    p_organization_id: organizationId,
    p_platform: platform,
    p_max_per_window: maxPerWindow,
  });

  if (error) throw new Error(error.message);
  return Boolean(data);
}
