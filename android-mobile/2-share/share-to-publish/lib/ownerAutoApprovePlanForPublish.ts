import { supabase } from "@/shared/lib/supabaseClient";
import {
  SHAREABLE_PLAN_SELECT,
  type ShareableSocialMediaPlan,
} from "./buildSharePlanQuery";

async function readShareablePlanById(planId: string): Promise<ShareableSocialMediaPlan> {
  const { data, error } = await supabase
    .from("social_media_plans")
    .select(SHAREABLE_PLAN_SELECT)
    .eq("id", planId)
    .single();
  if (error) throw error;
  return data as unknown as ShareableSocialMediaPlan;
}

/**
 * Writes concept + production approval fields before owner publish.
 * Mirrors desktop BriefDialog (concept) and GoogleDriveLinkDialog (production).
 */
export async function ownerAutoApprovePlanForPublish(args: {
  planId: string;
  snapshot?: Pick<ShareableSocialMediaPlan, "approved" | "production_approved">;
}): Promise<ShareableSocialMediaPlan> {
  const { planId, snapshot } = args;
  const current =
    snapshot ??
    (await readShareablePlanById(planId));

  const needsConcept = current.approved !== true;
  const needsProduction = current.production_approved !== true;

  if (!needsConcept && !needsProduction) {
    return readShareablePlanById(planId);
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {};

  if (needsConcept) {
    patch.status = "Approved";
    patch.approved = true;
    patch.completion_date = now;
  }

  if (needsProduction) {
    patch.production_status = "Approved";
    patch.production_approved = true;
    patch.production_approved_date = now;
  }

  const { error } = await supabase
    .from("social_media_plans")
    .update(patch)
    .eq("id", planId);
  if (error) throw error;

  return readShareablePlanById(planId);
}
