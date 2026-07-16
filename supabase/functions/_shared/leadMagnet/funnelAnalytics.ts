import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { LeadMagnetFunnelEventType } from "./types.ts";

export async function logLeadMagnetFunnelEvent(
  admin: SupabaseClient,
  args: {
    enrollmentId: string;
    campaignId: string;
    organizationId: string;
    eventType: LeadMagnetFunnelEventType;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await admin.from("lead_magnet_funnel_events").insert({
    enrollment_id: args.enrollmentId,
    campaign_id: args.campaignId,
    organization_id: args.organizationId,
    event_type: args.eventType,
    metadata: args.metadata ?? {},
  });
  if (error) {
    console.warn("[lead-magnet] funnel event insert failed:", args.eventType, error.message);
  }
}

export async function updateEnrollmentStatus(
  admin: SupabaseClient,
  enrollmentId: string,
  status: string,
  patch?: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin
    .from("lead_magnet_enrollments")
    .update({ status, updated_at: new Date().toISOString(), ...(patch ?? {}) })
    .eq("id", enrollmentId);
  if (error) {
    console.warn("[lead-magnet] enrollment update failed:", enrollmentId, status, error.message);
  }
}
