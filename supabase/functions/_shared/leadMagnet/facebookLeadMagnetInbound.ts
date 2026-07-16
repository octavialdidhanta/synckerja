import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildLeadMagnetPostbackPayload,
  LEAD_MAGNET_PAYLOAD_PREFIX,
  parseLeadMagnetPostbackPayload,
} from "./types.ts";
import { runLeadMagnetRuntime } from "./runLeadMagnetRuntime.ts";

type ActiveEnrollmentRow = {
  id: string;
  status: string;
  lead_magnet_campaigns: {
    follow_button_label: string;
    framework_button_label: string;
  } | {
    follow_button_label: string;
    framework_button_label: string;
  }[] | null;
};

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase();
}

async function findActiveFacebookEnrollment(
  admin: SupabaseClient,
  organizationId: string,
  participantScopedId: string,
): Promise<{ id: string; followLabel: string; frameworkLabel: string } | null> {
  const { data } = await admin
    .from("lead_magnet_enrollments")
    .select(`
      id,
      status,
      lead_magnet_campaigns!inner (
        follow_button_label,
        framework_button_label
      )
    `)
    .eq("organization_id", organizationId)
    .eq("platform", "facebook")
    .eq("participant_scoped_id", participantScopedId)
    .in("status", ["comment_replied", "follow_checked", "follow_gate_sent", "follow_validated", "framework_offered"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.id) return null;
  const row = data as ActiveEnrollmentRow;
  const campaignRaw = row.lead_magnet_campaigns;
  const campaign = Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw;
  if (!campaign) return null;

  return {
    id: String(row.id),
    followLabel: String(campaign.follow_button_label ?? ""),
    frameworkLabel: String(campaign.framework_button_label ?? ""),
  };
}

export async function resolveLeadMagnetFacebookPostbackPayload(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    participantScopedId: string;
    payload: string;
    title: string;
  },
): Promise<string | null> {
  const payload = args.payload.trim();
  if (payload.startsWith(LEAD_MAGNET_PAYLOAD_PREFIX)) {
    return payload;
  }

  const title = args.title.trim();
  if (!title) return null;

  const enrollment = await findActiveFacebookEnrollment(admin, args.organizationId, args.participantScopedId);
  if (!enrollment) return null;

  const normalizedTitle = normalizeLabel(title);
  if (enrollment.followLabel && normalizedTitle === normalizeLabel(enrollment.followLabel)) {
    return buildLeadMagnetPostbackPayload(enrollment.id, "follow_confirm");
  }
  if (enrollment.frameworkLabel && normalizedTitle === normalizeLabel(enrollment.frameworkLabel)) {
    return buildLeadMagnetPostbackPayload(enrollment.id, "get_framework");
  }

  return null;
}

export async function resolveLeadMagnetFacebookTextPayload(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    participantScopedId: string;
    text: string;
  },
): Promise<string | null> {
  const text = args.text.trim();
  if (!text) return null;

  const enrollment = await findActiveFacebookEnrollment(admin, args.organizationId, args.participantScopedId);
  if (!enrollment) return null;

  const normalized = normalizeLabel(text);
  if (enrollment.followLabel && normalized === normalizeLabel(enrollment.followLabel)) {
    return buildLeadMagnetPostbackPayload(enrollment.id, "follow_confirm");
  }
  if (enrollment.frameworkLabel && normalized === normalizeLabel(enrollment.frameworkLabel)) {
    return buildLeadMagnetPostbackPayload(enrollment.id, "get_framework");
  }

  return null;
}

export async function runLeadMagnetFacebookPostbackIfResolved(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    accountId: string;
    pageId: string;
    participantScopedId: string;
    payload: string;
    accessToken: string;
  },
): Promise<boolean> {
  const parsed = parseLeadMagnetPostbackPayload(args.payload);
  if (!parsed) {
    console.warn("[lead-magnet] invalid facebook postback payload", args.payload.slice(0, 80));
    return false;
  }

  return runLeadMagnetRuntime(admin, {
    trigger: "postback",
    platform: "facebook",
    organizationId: args.organizationId,
    accountId: args.accountId,
    participantScopedId: args.participantScopedId,
    participantUsername: null,
    payload: args.payload,
    accessToken: args.accessToken,
    pageId: args.pageId,
  });
}
