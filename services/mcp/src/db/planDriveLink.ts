import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PLAN_DRIVE_LINK_HOW_TO_READ,
  type SetPlanDriveLinkInput,
  type SetPlanDriveLinkResult,
} from "../tools/content/planDriveLink";

type Session = { userId: string; organizationId: string };

type DriveLinkRow = {
  id: string;
  title: string | null;
  google_drive_link: string | null;
  production_status: string | null;
  changed: boolean;
};

function asRow(data: unknown): DriveLinkRow | null {
  if (data == null) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row ? (row as DriveLinkRow) : null;
}

function driveLinkError(message: string): Error {
  if (message.includes("not_found")) return new Error("not_found");
  if (message.includes("not_a_member") || message.includes("forbidden")) return new Error("forbidden");
  if (message.includes("invalid_input")) return new Error("invalid_input");
  return new Error("request_failed");
}

export async function setContentPlanDriveLink(
  admin: SupabaseClient,
  ctx: Session,
  input: SetPlanDriveLinkInput,
): Promise<SetPlanDriveLinkResult> {
  const { data, error } = await admin.rpc("mcp_set_content_plan_drive_link", {
    p_user_id: ctx.userId,
    p_organization_id: ctx.organizationId,
    p_plan_id: input.planId,
    p_url: input.url,
  });
  if (error) throw driveLinkError(error.message ?? "");
  const row = asRow(data);
  if (!row?.id || !row.google_drive_link) throw new Error("request_failed");
  return {
    plan_id: row.id,
    title: row.title,
    google_drive_link: row.google_drive_link,
    production_status: row.production_status,
    changed: row.changed === true,
    how_to_read: PLAN_DRIVE_LINK_HOW_TO_READ,
  };
}
